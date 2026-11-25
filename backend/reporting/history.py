"""권한별 변경 이력과 복구용 원본. 기능 모델은 registry를 통해서만 참조합니다."""

import hashlib
import json
from datetime import timedelta
from pathlib import PurePosixPath
from zoneinfo import ZoneInfo

from django.core.files.base import ContentFile
from django.db.models import Count, Max
from django.db.models.fields.files import FieldFile, FileField
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.roles import is_admin
from . import registry
from .models import ChangeLog, Region, StaffMember


MASTER_MODELS = {'regions': Region, 'staff-members': StaffMember}


def history_models(section):
    if section in MASTER_MODELS:
        return (MASTER_MODELS[section],)
    history = registry.histories().get(section)
    if history:
        return history.models
    definition = registry.sections().get(section)
    return (definition.history_models or (definition.model,)) if definition else ()


def raw_row(instance):
    values = {field.attname: getattr(instance, field.attname)
              for field in instance._meta.concrete_fields if not field.generated}
    # DjangoJSONEncoder는 datetime의 마이크로초를 잘라내므로 원본 시각은 직접 보존합니다.
    values = {key: value.name if isinstance(value, FieldFile) else
              value.isoformat() if hasattr(value, 'isoformat') else value for key, value in values.items()}
    return json.loads(json.dumps(values, cls=DjangoJSONEncoder))


def capture_history(request, section):
    """데이터 잠금을 잡은 뒤, 수정 전에 호출합니다. 관련 원본은 변경된 행만 이력에 저장합니다."""
    request._history_before = (section, {
        model._meta.label_lower: {str(row.pk): raw_row(row) for row in model.objects.all()}
        for model in history_models(section)
    })
    definition = registry.sections().get(section)
    request._history_labels = definition.history_labels() if definition and definition.history_labels else {}


def meaningful(row):
    return {key: value for key, value in (row or {}).items() if key not in ('updated_at', 'can_edit')}


def scope_for(row, section, snapshots, regions):
    if not row:
        return {'regions': [], 'countries': []}
    history = registry.histories().get(section)
    if history and history.scope:
        return history.scope(row, snapshots)
    region_id = row.get('region_id', row.get('region'))
    if section == 'regions':
        region_id = row.get('id')
    region = regions.get(region_id)
    if section == 'regions':
        region = {'id': row['id'], 'region_name': row.get('region_name', ''), 'country_code': row.get('country_code', '')}
    countries = {row['country_code']} if row.get('country_code') else set()
    if region:
        countries.add(region['country_code'])
    # 운영 인력의 성명 변경도 배치 행과 같은 국가 범위로 묶습니다.
    if section == 'staff' and 'staff_name' in row and 'staff_id' not in row:
        for table in snapshots.values():
            countries.update(item['country_code'] for item in table.values()
                             if item.get('staff_id') == row.get('id') and item.get('country_code'))
    return {'regions': [region] if region else [], 'countries': sorted(countries)}


def restore_delta(request, section):
    captured = getattr(request, '_history_before', None)
    if not captured or captured[0] != section:
        return {}
    before = captured[1]
    after = {model._meta.label_lower: {str(row.pk): raw_row(row) for row in model.objects.all()}
             for model in history_models(section)}
    regions = {row.pk: {'id': row.pk, 'region_name': row.region_name, 'country_code': row.country_code}
               for row in Region.objects.all()}
    changes = []
    for label in before:
        for pk in dict.fromkeys([*before[label], *after[label]]):
            old, new = before[label].get(pk), after[label].get(pk)
            if meaningful(old) == meaningful(new):
                continue
            changes.append({'model': label, 'pk': pk, 'before': old, 'after': new,
                            'before_scope': scope_for(old, section, before, regions),
                            'after_scope': scope_for(new, section, after, regions)})
    files = []
    for model in history_models(section):
        for field in model._meta.concrete_fields:
            if not isinstance(field, FileField):
                continue
            for change in changes:
                if change['model'] != model._meta.label_lower or not change['before']:
                    continue
                name = change['before'].get(field.attname)
                if not name:
                    continue
                # 기능의 삭제 신호가 원본 파일을 지우기 전에 영속 미디어 볼륨에 보관합니다.
                with field.storage.open(name, 'rb') as source:
                    content = source.read()
                digest = hashlib.sha256(content).hexdigest()
                backup = f'history_backups/{digest}{PurePosixPath(name).suffix.lower()}'
                if not field.storage.exists(backup):
                    backup = field.storage.save(backup, ContentFile(content))
                files.append({'model': change['model'], 'pk': change['pk'], 'field': field.attname,
                              'name': name, 'backup': backup, 'sha256': digest})
    definition = registry.sections().get(section)
    labels = {**getattr(request, '_history_labels', {}),
              **(definition.history_labels() if definition and definition.history_labels else {})}
    return {'changes': changes, 'files': files, 'labels': labels}


def clean_data(value):
    if isinstance(value, list):
        return [clean_data(item) for item in value]
    if isinstance(value, dict):
        return {key: clean_data(item) for key, item in value.items()
                if key not in ('author_username', 'actor_username', 'author_id', 'uploader_id', 'password', 'can_edit')}
    return value


def legacy_changes(log):
    """과거 이력은 조회만 지원합니다. 일괄 저장 원본에서도 실제 바뀐 행만 추립니다."""
    before, after = log.before_data, log.after_data
    def rows(value):
        return value.get('rows', []) if 'rows' in value else ([value] if value else [])
    def key(row):
        return str(row.get('id', row.get('service_code', 'single')))
    old, new = {key(row): row for row in rows(before)}, {key(row): row for row in rows(after)}
    region_ids = {row.get('region_id', row.get('region')) for row in (*old.values(), *new.values())}
    regions = Region.objects.in_bulk(pk for pk in region_ids if isinstance(pk, int))
    regions = {pk: {'id': pk, 'region_name': region.region_name, 'country_code': region.country_code}
               for pk, region in regions.items()}
    result = []
    for pk in dict.fromkeys([*old, *new]):
        a, b = old.get(pk), new.get(pk)
        if meaningful(a) == meaningful(b):
            continue
        result.append({'before': a, 'after': b,
                       'before_scope': scope_for(a, log.section, {}, regions),
                       'after_scope': scope_for(b, log.section, {}, regions)})
    return result


def history_queryset(user):
    if not is_admin(user):
        return ChangeLog.objects.none()
    return (ChangeLog.objects.exclude(section__in=('issues', 'work', 'services'))
            .exclude(restore_data__has_key='changes', restore_data__changes=[])
            .select_related('restoration'))


def history_entry(log):
    captured = log.restore_data.get('changes')
    changes = legacy_changes(log) if captured is None else captured
    pairs, regions, countries = [], {}, set()
    for change in changes:
        pairs.append({'model': change.get('model', ''), 'before': clean_data(change.get('before')),
                      'after': clean_data(change.get('after'))})
        for key in ('before_scope', 'after_scope'):
            scope = change.get(key, {})
            regions.update((region['id'], region) for region in scope.get('regions', []))
            countries.update(scope.get('countries', []))
    restored = bool(getattr(log, 'restoration', None))
    can_restore = bool(captured and history_models(log.section) and not restored and log.action != 'restore')
    return {
        'id': log.pk, 'section': log.section, 'month': log.period_month.strftime('%Y-%m') if log.period_month else None,
        'action': log.action, 'actor_name': log.actor_name, 'summary': log.summary, 'created_at': log.created_at,
        'before_data': {'rows': [pair['before'] for pair in pairs if pair['before']]},
        'after_data': {'rows': [pair['after'] for pair in pairs if pair['after']]}, 'changes': pairs,
        'regions': list(regions.values()), 'countries': sorted(countries), 'column_labels': log.restore_data.get('labels', {}),
        'can_restore': can_restore, 'restored': restored,
        'restore_reason': ('이미 복구한 변경입니다.' if restored else '복구 작업은 다시 복구할 수 없습니다.' if log.action == 'restore'
                           else '' if can_restore else '조회 전용 이력입니다.'),
    }


def history_page(user, params):
    catalog = history_queryset(user)
    rows = catalog
    if params.get('section'):
        rows = rows.filter(section=params['section'])
    if params.get('action'):
        if params['action'] not in ('create', 'update', 'delete', 'restore'):
            raise ValidationError('올바른 작업 종류를 선택하세요.')
        rows = rows.filter(action=params['action'])
    if params.get('days'):
        if params['days'] not in ('1', '7', '30'):
            raise ValidationError('기간은 1·7·30일 중에서 선택하세요.')
        today = timezone.localtime(timezone.now(), ZoneInfo('Asia/Seoul')).replace(hour=0, minute=0, second=0, microsecond=0)
        rows = rows.filter(created_at__gte=today - timedelta(days=int(params['days']) - 1))
    try:
        offset = max(0, int(params.get('offset', 0)))
    except ValueError as exc:
        raise ValidationError('페이지 값이 올바르지 않습니다.') from exc
    end = offset + 30
    total = rows.count()
    tabs = catalog.values('section').annotate(count=Count('pk'), latest_at=Max('created_at')).order_by('-latest_at', 'section')
    return {
        'results': [history_entry(log) for log in rows[offset:end]], 'count': total,
        'next_offset': end if end < total else None,
        'tabs': [{'id': tab['section'], 'count': tab['count'], 'latest_at': tab['latest_at']} for tab in tabs],
        'actions': dict(catalog.order_by().values_list('action').annotate(count=Count('pk'))),
    }
