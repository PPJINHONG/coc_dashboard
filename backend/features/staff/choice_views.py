from django.db import IntegrityError, transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.roles import is_admin, record_activity
from reporting.history import capture_history
from reporting.services import bump, check_revision, lock_state, record_log
from .calendar_views import StaffView
from .models import StaffAssignment, StaffChoice, StaffColumn
from .items import RESERVED_LABELS, choice_rows, column_order, item_catalog, save_base_positions


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffChoice
        fields = ['id', 'kind', 'value']
        read_only_fields = ['id']
        validators = []

    def validate(self, attrs):
        kind = attrs['kind']
        column = StaffColumn.objects.filter(key=kind).first()
        if column is None:
            raise serializers.ValidationError('추가 열을 먼저 등록한 후 값을 추가하세요.')
        value = ' '.join(attrs['value'].split())
        if not value:
            raise serializers.ValidationError({'value': '항목 값을 입력하세요.'})
        attrs['value'] = value
        attrs['column'] = column
        return attrs


def response_payload(state):
    return {'revision': state.revision, 'choices': choice_rows(), 'items': item_catalog(), 'column_order': column_order()}


class StaffChoicesView(StaffView):
    def get(self, request):
        return Response({'choices': choice_rows(), 'can_manage': is_admin(request.user), 'items': item_catalog(), 'column_order': column_order()})

    @transaction.atomic
    def post(self, request):
        return self.change(request)

    @transaction.atomic
    def delete(self, request, pk):
        return self.change(request, pk)

    def change(self, request, pk=None):
        if not is_admin(request.user):
            raise PermissionDenied('항목 값 관리는 관리자만 사용할 수 있습니다.')
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        capture_history(request, 'staff')
        before, after = None, None
        if pk is not None:
            instance = get_object_or_404(StaffChoice.objects.select_related('column'), pk=pk)
            before = dict(ChoiceSerializer(instance).data)
            summary = f'{instance.column.label} 선택값 삭제: {instance.value}'
            instance.delete()
        else:
            serializer = ChoiceSerializer(data=request.data.get('choice'))
            serializer.is_valid(raise_exception=True)
            try:
                instance = serializer.save()
            except IntegrityError as exc:
                raise ValidationError('이미 등록된 선택값입니다.') from exc
            after = dict(serializer.data)
            summary = f'{instance.column.label} 선택값 추가: {instance.value}'
        bump(state)
        action = 'delete' if pk is not None else 'create'
        record_log(request, 'staff', action, summary, before=before, after=after)
        record_activity(request, action, summary, 'staff_choice', pk or instance.pk, before=before, after=after)
        return Response(response_payload(state))


class StaffColumnsView(StaffView):
    def check_admin(self, user):
        if not is_admin(user):
            raise PermissionDenied('추가 열 관리는 관리자만 사용할 수 있습니다.')

    @transaction.atomic
    def post(self, request):
        self.check_admin(request.user)
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        label = request.data.get('label')
        if not isinstance(label, str):
            raise ValidationError('추가할 열 이름을 입력하세요.')
        label = ' '.join(label.split())
        if not label or len(label) > 80 or label in RESERVED_LABELS or StaffColumn.objects.filter(label__iexact=label).exists():
            raise ValidationError('기존 열과 겹치지 않는 80자 이하의 열 이름을 입력하세요.')
        if StaffColumn.objects.count() >= 100:
            raise ValidationError('추가 열은 100개까지 등록할 수 있습니다.')
        free_text = request.data.get('allow_free_text', False)
        if not isinstance(free_text, bool):
            raise ValidationError('자유 입력 허용 여부를 확인하세요.')
        capture_history(request, 'staff')
        position = (StaffColumn.objects.aggregate(value=Max('position'))['value'] or 0) + 1
        column = StaffColumn.objects.create(label=label, allow_free_text=free_text, position=position)
        after = {'id': column.pk, 'key': column.key, 'label': column.label, 'allow_free_text': column.allow_free_text, 'position': column.position}
        bump(state)
        summary = f'운영 인력 열 추가: {label}'
        record_log(request, 'staff', 'create', summary, after=after)
        record_activity(request, 'create', summary, 'staff_column', column.pk, after=after)
        return Response({**response_payload(state), 'column': after}, status=201)

    @transaction.atomic
    def patch(self, request, key=None):
        self.check_admin(request.user)
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        column = get_object_or_404(StaffColumn, key=key)
        enabled = request.data.get('allow_free_text')
        if not isinstance(enabled, bool):
            raise ValidationError('자유 입력 허용 여부를 확인하세요.')
        if enabled != column.allow_free_text:
            capture_history(request, 'staff')
            before = {'allow_free_text': column.allow_free_text}
            column.allow_free_text = enabled
            column.save(update_fields=['allow_free_text'])
            after = {'allow_free_text': enabled}
            bump(state)
            summary = f'운영 인력 열 자유 입력 설정 변경: {column.label}'
            record_log(request, 'staff', 'update', summary, before=before, after=after)
            record_activity(request, 'update', summary, 'staff_column', column.pk, before=before, after=after)
        return Response(response_payload(state))

    @transaction.atomic
    def put(self, request):
        self.check_admin(request.user)
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        keys = request.data.get('keys')
        columns = list(StaffColumn.objects.select_for_update())
        before = column_order()
        full_order = isinstance(keys, list) and 'staff_name' in keys and 'country_code' in keys
        expected = before if full_order else [column.key for column in columns]
        if not isinstance(keys, list) or any(not isinstance(key, str) for key in keys) or set(keys) != set(expected) or len(keys) != len(expected):
            raise ValidationError('현재 추가 열 전체를 중복 없이 순서대로 보내세요.')
        by_key = {column.key: column for column in columns}
        capture_history(request, 'staff')
        if full_order:
            save_base_positions(keys)
        for position, key in enumerate((key for key in keys if key in by_key), 1):
            by_key[key].position = position
        StaffColumn.objects.bulk_update(columns, ['position'])
        bump(state)
        summary = '운영 인력 추가 열 순서 변경'
        record_log(request, 'staff', 'update', summary, before={'keys': before}, after={'keys': column_order()})
        record_activity(request, 'update', summary, 'staff_column_order', '', before={'keys': before}, after={'keys': column_order()})
        return Response(response_payload(state))

    @transaction.atomic
    def delete(self, request, key):
        self.check_admin(request.user)
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        column = get_object_or_404(StaffColumn.objects.select_for_update(), key=key)
        uses = sum(key in (values or {}) for values in StaffAssignment.objects.values_list('custom_values', flat=True))
        if uses:
            raise ValidationError(f'‘{column.label}’ 열은 {uses}명의 인력이 사용 중이므로 삭제할 수 없습니다.')
        choices_count = StaffChoice.objects.filter(column=column).count()
        if choices_count:
            raise ValidationError(f'‘{column.label}’ 열의 등록된 항목 값 {choices_count}개를 먼저 삭제하세요.')
        before = {'id': column.pk, 'key': column.key, 'label': column.label, 'allow_free_text': column.allow_free_text, 'position': column.position}
        capture_history(request, 'staff')
        column_id, label = column.pk, column.label
        remaining_order = [entry for entry in column_order() if entry != key]
        column.delete()
        save_base_positions(remaining_order)
        remaining = list(StaffColumn.objects.order_by('position', 'id'))
        for position, item in enumerate(remaining, 1):
            item.position = position
        StaffColumn.objects.bulk_update(remaining, ['position'])
        bump(state)
        summary = f'운영 인력 열 삭제: {label}'
        record_log(request, 'staff', 'delete', summary, before=before)
        record_activity(request, 'delete', summary, 'staff_column', column_id, before=before)
        return Response(response_payload(state))
