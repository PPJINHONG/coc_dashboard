"""관리자 복구: 미리보기 → 서명된 확인 → 충돌 검사 → 단일 트랜잭션 반영."""

import hashlib

from django.core import signing
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError as ModelValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.roles import record_activity
from .history import capture_history, history_models, meaningful, raw_row
from .models import ChangeLog
from .services import Conflict, bump, check_revision, lock_state, record_log
from .views import AdminDataView

SALT = 'operations-history-restore'


def restoration_plan(log):
    if log.action == 'restore' or ChangeLog.objects.filter(restored_from=log).exists():
        raise Conflict('이미 복구했거나 복구 작업 자체인 이력입니다.')
    changes = log.restore_data.get('changes', [])
    if not changes:
        raise ValidationError('복구 원본이 없는 과거 이력은 자동 복구할 수 없습니다.')
    models = {model._meta.label_lower: model for model in history_models(log.section)}
    for change in changes:
        model = models.get(change['model'])
        if model is None:
            raise ValidationError('데이터 구조가 변경되어 자동 복구할 수 없습니다.')
        current = model.objects.select_for_update().filter(pk=change['pk']).first()
        if ((current is None) != (change['after'] is None) or
                meaningful(raw_row(current) if current else None) != meaningful(change['after'])):
            raise Conflict('이 변경 이후 같은 데이터가 수정되었습니다. 이후 이력을 먼저 확인해 주세요.')
    for file in log.restore_data.get('files', []):
        model = models.get(file['model'])
        if model is None or not model._meta.get_field(file['field']).storage.exists(file['backup']):
            raise Conflict('첨부파일 복구 원본을 찾을 수 없어 복구하지 않았습니다.')
    return changes, models


def restore_files(log, models):
    for file in log.restore_data.get('files', []):
        storage = models[file['model']]._meta.get_field(file['field']).storage
        with storage.open(file['backup'], 'rb') as source:
            content = source.read()
        if hashlib.sha256(content).hexdigest() != file['sha256']:
            raise Conflict('첨부파일 복구 원본이 변경되어 복구하지 않았습니다.')
        if storage.exists(file['name']):
            with storage.open(file['name'], 'rb') as source:
                if hashlib.sha256(source.read()).hexdigest() != file['sha256']:
                    raise Conflict('같은 경로의 첨부파일이 변경되어 복구하지 않았습니다.')
        else:
            saved = storage.save(file['name'], ContentFile(content))
            if saved != file['name']:
                storage.delete(saved)
                raise Conflict('첨부파일 경로에 다른 파일이 등록되어 복구하지 않았습니다.')


class RestorePreviewView(AdminDataView):
    @transaction.atomic
    def post(self, request, pk):
        state = lock_state()
        log = get_object_or_404(ChangeLog, pk=pk)
        changes, _ = restoration_plan(log)
        token = signing.dumps({'user': request.user.pk, 'log': pk, 'revision': state.revision}, salt=SALT)
        return Response({'token': token, 'revision': state.revision, 'summary': log.summary,
                         'affected_count': len(changes), 'month': log.period_month.strftime('%Y-%m') if log.period_month else None})


class RestoreView(AdminDataView):
    @transaction.atomic
    def post(self, request, pk):
        if not isinstance(request.data, dict):
            raise ValidationError('객체 형식으로 요청하세요.')
        if request.data.get('confirmed') is not True:
            raise ValidationError('최종 복구 확인이 필요합니다.')
        try:
            approval = signing.loads(request.data.get('token', ''), salt=SALT, max_age=300)
        except (signing.BadSignature, TypeError, ValueError) as exc:
            raise ValidationError('확인이 만료되었거나 올바르지 않습니다. 복구 버튼을 다시 누르세요.') from exc
        if approval.get('user') != request.user.pk or approval.get('log') != pk:
            raise ValidationError('이 복구 요청에 대한 확인이 아닙니다.')
        state = lock_state()
        check_revision(state, approval.get('revision'))
        log = get_object_or_404(ChangeLog, pk=pk)
        changes, models = restoration_plan(log)
        capture_history(request, log.section)
        try:
            with transaction.atomic():
                # 삭제됐던 부모부터 복원하고, 연결을 되돌린 뒤 새로 추가됐던 자식을 제거합니다.
                # 요청 등록을 취소할 때는 첨부를 업로드 초안으로 먼저 분리해 CASCADE 삭제를 막습니다.
                for change in changes:
                    values = change['before']
                    if values is None or change['after'] is not None:
                        continue
                    model = models[change['model']]
                    instance = model(**values)
                    instance.full_clean(exclude=[field.name for field in model._meta.concrete_fields if field.generated])
                    model.objects.create(**values)
                    model.objects.filter(pk=change['pk']).update(**values)
                for change in changes:
                    if change['before'] is None or change['after'] is None:
                        continue
                    model = models[change['model']]
                    instance = model(**change['before'])
                    instance._state.adding = False
                    instance.full_clean(exclude=[field.name for field in model._meta.concrete_fields if field.generated])
                    model.objects.filter(pk=change['pk']).update(**change['before'])
                for change in reversed(changes):
                    if change['before'] is None:
                        models[change['model']].objects.filter(pk=change['pk']).delete()
                restore_files(log, models)
        except (ProtectedError, IntegrityError, ModelValidationError, ValueError, TypeError, OSError) as exc:
            raise Conflict('연결된 데이터 또는 현재 데이터 구조와 충돌하여 복구하지 않았습니다.') from exc
        bump(state)
        restored = record_log(request, log.section, 'restore', f'변경 이력 #{log.pk} 복구: {log.summary}'[:300],
                              before=log.after_data, after=log.before_data, month=log.period_month)
        restored.restored_from = log
        restored.save(update_fields=['restored_from'])
        record_activity(request, 'restore', restored.summary, 'change_log', log.pk,
                        before={'changes': log.restore_data['changes']}, after={'restoration_id': restored.pk})
        return Response({'revision': state.revision, 'restoration_id': restored.pk})
