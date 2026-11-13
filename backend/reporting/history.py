"""권한별 변경 이력과 복구용 원본. 기능 모델은 registry를 통해서만 참조합니다."""

import hashlib
import json
from pathlib import PurePosixPath

from django.core.files.base import ContentFile
from django.db.models.fields.files import FieldFile, FileField
from django.core.serializers.json import DjangoJSONEncoder

from core.roles import ROLE_GROUP_LEAD, ROLE_TEAM_LEAD, is_admin, managed_countries, user_role
from . import registry
from .models import ChangeLog, Region, Service, StaffMember


MASTER_MODELS = {'regions': Region, 'services': Service, 'staff-members': StaffMember}


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
    # 이전 이슈·댓글 이력의 리전 이름은 원본에서 읽을 수 있을 때만 표시합니다.
    if row.get('issue_id', row.get('issue')) is not None:
        issue_id = str(row.get('issue_id', row.get('issue')))
        for table in snapshots.values():
            issue = table.get(issue_id)
            if issue and 'title' in issue and 'region_id' in issue:
                region_id = issue['region_id']
                break
        if region_id is None:
            definition = registry.sections().get(section)
            if definition and any(field.name == 'region' for field in definition.model._meta.concrete_fields):
                region_id = definition.model.objects.filter(pk=issue_id).values_list('region_id', flat=True).first()
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
    return {'changes': changes, 'files': files}


def clean_data(value, private_fields=()):
    if isinstance(value, list):
        return [clean_data(item, private_fields) for item in value]
    if isinstance(value, dict):
        return {key: clean_data(item, private_fields) for key, item in value.items()
                if key not in ('author_username', 'actor_username', 'author_id', 'uploader_id', 'password', 'can_edit', *private_fields)}
    return value


def legacy_changes(log):
    """과거 이력은 조회만 지원합니다. 일괄 저장 원본에서도 실제 바뀐 행만 추립니다."""
    before, after = log.before_data, log.after_data
    def rows(value):
        return value.get('rows', []) if 'rows' in value else ([value] if value else [])
    def key(row):
        return str(row.get('id', row.get('service_code', 'single')))
    old, new = {key(row): row for row in rows(before)}, {key(row): row for row in rows(after)}
    regions = {row.pk: {'id': row.pk, 'region_name': row.region_name, 'country_code': row.country_code}
               for row in Region.objects.all()}
    result = []
    for pk in dict.fromkeys([*old, *new]):
        a, b = old.get(pk), new.get(pk)
        if meaningful(a) == meaningful(b):
            continue
        result.append({'before': a, 'after': b,
                       'before_scope': scope_for(a, log.section, {}, regions),
                       'after_scope': scope_for(b, log.section, {}, regions)})
    return result


def actor_key(log):
    return hashlib.sha256((log.actor_username or log.actor_name).casefold().encode()).hexdigest()


def visible_history(user, params=None, limit=None):
    """범위 밖 원본은 응답에서 제거합니다. 필터는 항상 권한 범위 적용 뒤에 적용합니다."""
    params = params or {}
    if not user or not user.is_authenticated or not user.is_active:
        return []
    role = user_role(user)
    unrestricted = is_admin(user) or role == ROLE_TEAM_LEAD
    countries = set(managed_countries(user)) if role == ROLE_GROUP_LEAD else set()
    queryset = ChangeLog.objects.exclude(section='issues').select_related('restoration')
    if not unrestricted and role != ROLE_GROUP_LEAD:
        queryset = queryset.filter(actor_username__iexact=user.username)
    if params.get('month'):
        from .months import parse_month
        queryset = queryset.filter(period_month=parse_month(params['month']))
    output = []
    for log in queryset:
        definition = registry.sections().get(log.section)
        private_fields = definition.private_fields if definition and not unrestricted else ()
        if params.get('actor') and actor_key(log) != params['actor']:
            continue
        changes = log.restore_data.get('changes') if log.restore_data else None
        if changes == []:
            continue
        changes = changes if changes is not None else legacy_changes(log)
        before, after, visible_regions, visible_countries = [], [], {}, set()
        for change in changes:
            sides = []
            for side in ('before', 'after'):
                row = change.get(side)
                scope = change.get(f'{side}_scope', {'regions': [], 'countries': []})
                allowed = unrestricted or (role != ROLE_GROUP_LEAD) or bool(countries.intersection(scope['countries']))
                if not row or not allowed:
                    continue
                if params.get('region') and not any(str(region['id']) == params['region'] for region in scope['regions']):
                    continue
                sides.append((side, row, scope))
            for side, row, scope in sides:
                (before if side == 'before' else after).append(clean_data(row, private_fields))
                visible_regions.update({region['id']: region for region in scope['regions']})
                visible_countries.update(scope['countries'])
        # 내용이 없는 옛 기록은 전체 조회 권한 또는 본인에게만 보입니다.
        if not before and not after and (changes or role == ROLE_GROUP_LEAD or params.get('region')):
            continue
        restored = getattr(log, 'restoration', None)
        can_restore = bool(is_admin(user) and history_models(log.section) and log.restore_data.get('changes') and not restored and log.action != 'restore')
        output.append({
            'id': log.pk, 'section': log.section, 'month': log.period_month.strftime('%Y-%m') if log.period_month else None,
            'action': log.action, 'actor_name': log.actor_name, 'actor_key': actor_key(log),
            'summary': log.summary if unrestricted or role != ROLE_GROUP_LEAD else '관리 권역 데이터 변경',
            'before_data': {'rows': before}, 'after_data': {'rows': after}, 'created_at': log.created_at,
            'regions': list(visible_regions.values()), 'countries': sorted(visible_countries),
            'can_restore': can_restore, 'restored': bool(restored),
            'restore_reason': ('이미 복구한 변경입니다.' if restored else
                               '복구 작업은 다시 복구할 수 없습니다.' if log.action == 'restore' else
                               '복구 원본이 없는 과거 이력입니다.' if not log.restore_data.get('changes') else ''),
        })
        if limit and len(output) >= limit:
            break
    return output
