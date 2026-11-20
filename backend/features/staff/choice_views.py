from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.roles import can_manage_members, record_activity, staff_edit_countries
from reporting.history import capture_history
from reporting.services import bump, check_revision, lock_state, record_log
from .calendar_views import StaffView
from .models import StaffChoice, StaffColumn
from .items import RESERVED_LABELS, choice_rows, item_catalog


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffChoice
        fields = ['id', 'kind', 'country_code', 'value']
        read_only_fields = ['id']
        validators = []

    def validate(self, attrs):
        kind = attrs['kind']
        if kind not in ('company_name', 'work_location', 'grade'):
            column = StaffColumn.objects.filter(key=kind).first()
            if column is None:
                raise serializers.ValidationError('항목을 먼저 추가한 후 값을 등록하세요.')
            attrs['column'] = column
        if attrs['kind'] == 'work_location' and attrs.get('country_code') not in ('KR', 'EU', 'NA'):
            raise serializers.ValidationError('근무지의 권역을 선택하세요.')
        if attrs['kind'] != 'work_location':
            attrs['country_code'] = ''
        maximum = {'company_name': 100, 'grade': 40}.get(kind, 150)
        if len(attrs['value']) > maximum:
            raise serializers.ValidationError(f'값은 {maximum}자 이하로 입력하세요.')
        return attrs


def choices(with_grade=True):
    return choice_rows(with_grade)


class StaffChoicesView(StaffView):
    def get(self, request):
        can_manage = can_manage_members(request.user)
        return Response({'choices': choices(can_manage), 'can_manage': can_manage, 'items': item_catalog(can_manage)})

    @transaction.atomic
    def post(self, request):
        return self.change(request)

    @transaction.atomic
    def delete(self, request, pk):
        return self.change(request, pk)

    def change(self, request, pk=None):
        # 근무지는 권역 설정에서 관리 권역의 책임자(그룹장 포함)도 추가·삭제합니다. 그 외 항목은 관리자·팀장만 합니다.
        if pk is not None:
            target = get_object_or_404(StaffChoice, pk=pk)
            kind, country = target.kind, target.country_code
        else:
            raw = request.data.get('choice')
            kind, country = (raw.get('kind'), raw.get('country_code')) if isinstance(raw, dict) else (None, None)
        regional = kind == 'work_location' and country in staff_edit_countries(request.user)
        if not can_manage_members(request.user) and not regional:
            raise PermissionDenied('근무지는 관리 권역만, 그 외 선택지는 관리자와 팀장만 추가·삭제할 수 있습니다.')
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        capture_history(request, 'staff')
        before, after = None, None
        if pk is not None:
            instance = get_object_or_404(StaffChoice, pk=pk)
            before = dict(ChoiceSerializer(instance).data)
            summary = f'{instance.get_kind_display()} 선택지 삭제: {instance.value}'
            instance.delete()
        else:
            serializer = ChoiceSerializer(data=request.data.get('choice'))
            serializer.is_valid(raise_exception=True)
            try:
                with transaction.atomic():
                    instance = serializer.save()
            except IntegrityError as exc:
                raise ValidationError('이미 등록된 선택지입니다.') from exc
            after = dict(serializer.data)
            summary = f'{instance.get_kind_display()} 선택지 추가: {instance.value}'
        bump(state)
        action = 'delete' if pk is not None else 'create'
        record_log(request, 'staff', action, summary, before=before, after=after)
        record_activity(request, action, summary, 'staff_choice', pk or instance.pk, before=before, after=after)
        visible = can_manage_members(request.user)
        return Response({'revision': state.revision, 'choices': choices(visible), 'items': item_catalog(visible)})


class StaffColumnsView(StaffView):
    @transaction.atomic
    def post(self, request):
        if not can_manage_members(request.user):
            raise PermissionDenied('열 추가는 관리자와 팀장만 할 수 있습니다.')
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
        capture_history(request, 'staff')
        column = StaffColumn.objects.create(label=label)
        after = {'key': column.key, 'label': column.label}
        bump(state)
        summary = f'운영 인력 열 추가: {label}'
        record_log(request, 'staff', 'create', summary, after=after)
        record_activity(request, 'create', summary, 'staff_column', column.pk, after=after)
        return Response({'revision': state.revision, 'column': after, 'items': item_catalog(True), 'choices': choices()}, status=201)
