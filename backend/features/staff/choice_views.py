from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.roles import can_manage_members, record_activity
from reporting.history import capture_history
from reporting.services import bump, check_revision, lock_state, record_log
from .calendar_views import StaffView
from .models import StaffChoice


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffChoice
        fields = ['id', 'kind', 'country_code', 'value']
        read_only_fields = ['id']
        validators = []

    def validate(self, attrs):
        if attrs['kind'] == 'work_location' and attrs.get('country_code') not in ('KR', 'EU', 'NA'):
            raise serializers.ValidationError('근무지의 권역을 선택하세요.')
        if attrs['kind'] == 'company_name':
            attrs['country_code'] = ''
            if len(attrs['value']) > 100:
                raise serializers.ValidationError('소속사는 100자 이하로 입력하세요.')
        return attrs


def choices():
    return ChoiceSerializer(StaffChoice.objects.all(), many=True).data


class StaffChoicesView(StaffView):
    def get(self, request):
        return Response({'choices': choices(), 'can_manage': can_manage_members(request.user)})

    @transaction.atomic
    def post(self, request):
        return self.change(request)

    @transaction.atomic
    def delete(self, request, pk):
        return self.change(request, pk)

    def change(self, request, pk=None):
        if not can_manage_members(request.user):
            raise PermissionDenied('선택지 추가·삭제는 관리자와 팀장만 할 수 있습니다.')
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
        return Response({'revision': state.revision, 'choices': choices()})
