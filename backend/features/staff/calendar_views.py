from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import can_manage_members, record_activity, staff_edit_countries
from reporting.history import capture_history
from reporting.months import parse_month
from reporting.services import lock_state, check_revision, bump, record_log
from .models import StaffAssignment, StaffCalendarEvent, StaffResponsibility, StaffChoice
from .permissions import can_view_grade, owns_profile
from .serializers import CalendarSerializer, ResponsibilitySerializer, local_today


@method_decorator(csrf_protect, name='dispatch')
class StaffView(APIView):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_active:
            raise PermissionDenied('활성 회원만 사용할 수 있습니다.')
        if request.method in ('POST', 'PATCH', 'PUT', 'DELETE') and not isinstance(request.data, dict):
            raise ValidationError('객체 형식으로 요청하세요.')


def country_filter(request):
    country = request.query_params.get('country', '')
    if country and country not in ('KR', 'EU', 'NA'):
        raise ValidationError('권역은 KR·EU·NA 중에서 선택하세요.')
    return country


def changed(request, state, summary, before=None, after=None, action='update', target=''):
    bump(state)
    record_log(request, 'staff', action, summary, before=before, after=after)
    record_activity(request, action, summary, 'staff', target, before=before, after=after)


class StaffOptionsView(StaffView):
    def get(self, request):
        profile = StaffAssignment.objects.filter(account=request.user).first()
        accounts = []
        if can_view_grade(request.user):
            accounts = [{'id': user.pk, 'name': user.get_full_name() or user.username, 'username': user.username}
                        for user in get_user_model().objects.filter(is_active=True).order_by('first_name', 'username')]
        return Response({
            'my_assignment': profile.pk if profile else None,
            'can_edit_calendar': bool(profile and owns_profile(request.user, profile)),
            'can_view_grade': can_view_grade(request.user),
            'can_manage_choices': can_manage_members(request.user),
            'choices': list(StaffChoice.objects.values('id', 'kind', 'country_code', 'value')),
            'accounts': accounts,
            'responsibilities': ResponsibilitySerializer(StaffResponsibility.objects.select_related(
                'site_representative__staff', 'team_lead__staff', 'group_lead__staff'), many=True).data,
        })


class CalendarView(StaffView):
    def get(self, request):
        country = country_filter(request)
        start = parse_month(request.query_params.get('month'))
        if start.year == 9999:
            raise ValidationError('지원하지 않는 조회 연도입니다.')
        end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        rows = StaffCalendarEvent.objects.select_related('assignment__staff', 'assignment__account').filter(start_date__lt=end, end_date__gte=start)
        if country:
            rows = rows.filter(assignment__country_code=country)
        return Response({'events': CalendarSerializer(rows, many=True, context={'request': request}).data})

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        profile = StaffAssignment.objects.select_for_update().filter(account=request.user).first()
        if not profile or not owns_profile(request.user, profile):
            raise PermissionDenied('회원 계정이 연결된 본인의 캘린더만 등록할 수 있습니다.')
        capture_history(request, 'staff')
        serializer = CalendarSerializer(data=request.data.get('event'))
        serializer.is_valid(raise_exception=True)
        validate_event(profile, serializer.validated_data)
        event = serializer.save(assignment=profile, country_code=profile.country_code)
        after = dict(CalendarSerializer(event, context={'request': request}).data)
        changed(request, state, f'{profile.staff.staff_name} 캘린더 등록', after=after, action='create', target=str(event.pk))
        return Response({'revision': state.revision, 'event': after}, status=201)


def validate_event(profile, values, instance=None):
    start = values.get('start_date', getattr(instance, 'start_date', None))
    end = values.get('end_date', getattr(instance, 'end_date', None))
    if profile.deployment_date and start < profile.deployment_date:
        raise ValidationError('업무 투입일 이전에는 운영 인력 일정을 등록할 수 없습니다.')
    if profile.resignation_date and end > profile.resignation_date:
        raise ValidationError('회사 퇴사일 이후에는 일정을 등록할 수 없습니다.')
    overlaps = StaffCalendarEvent.objects.filter(assignment=profile, start_date__lte=end, end_date__gte=start)
    if instance:
        overlaps = overlaps.exclude(pk=instance.pk)
    if overlaps.exists():
        raise ValidationError('이미 등록한 휴가 일정과 기간이 겹칩니다.')


class CalendarEventView(StaffView):
    @transaction.atomic
    def patch(self, request, pk):
        return self.save(request, pk)

    @transaction.atomic
    def delete(self, request, pk):
        return self.save(request, pk, deleting=True)

    def save(self, request, pk, deleting=False):
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        event = get_object_or_404(StaffCalendarEvent.objects.select_for_update(of=('self',)).select_related('assignment__staff'), pk=pk)
        if not owns_profile(request.user, event.assignment):
            raise PermissionDenied('본인의 캘린더만 수정·삭제할 수 있습니다.')
        capture_history(request, 'staff')
        before = dict(CalendarSerializer(event, context={'request': request}).data)
        after = None
        if deleting:
            event.delete()
        else:
            serializer = CalendarSerializer(event, data=request.data.get('event'), partial=True)
            serializer.is_valid(raise_exception=True)
            validate_event(event.assignment, serializer.validated_data, event)
            event = serializer.save(country_code=event.assignment.country_code)
            after = dict(CalendarSerializer(event, context={'request': request}).data)
        changed(request, state, f'{before["staff_name"]} 캘린더 {"삭제" if deleting else "수정"}', before=before, after=after,
                action='delete' if deleting else 'update', target=str(pk))
        return Response({'revision': state.revision, 'event': after})


class ResponsibilityView(StaffView):
    @transaction.atomic
    def put(self, request):
        raw = request.data.get('responsibility')
        if not isinstance(raw, dict) or raw.get('country_code') not in staff_edit_countries(request.user):
            raise PermissionDenied('관리 권역의 책임자만 지정할 수 있습니다.')
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        capture_history(request, 'staff')
        instance = StaffResponsibility.objects.filter(pk=raw['country_code']).first()
        before = dict(ResponsibilitySerializer(instance).data) if instance else None
        serializer = ResponsibilitySerializer(instance, data=raw)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        after = dict(ResponsibilitySerializer(instance).data)
        changed(request, state, f'{instance.country_code} 권역 책임자 변경', before=before, after=after, target=instance.country_code)
        return Response({'revision': state.revision, 'responsibility': after})


class StaffTrendView(StaffView):
    def get(self, request):
        country = country_filter(request)
        end = parse_month(request.query_params.get('month'))
        if not 2 <= end.year <= 9998:
            raise ValidationError('지원하지 않는 조회 연도입니다.')
        company = request.query_params.get('company', '')
        rows = StaffAssignment.objects.all()
        if country:
            rows = rows.filter(country_code=country)
        if company:
            rows = rows.filter(company_name=company)
        missing = rows.filter(deployment_date__isnull=True).count()
        known = list(rows.filter(deployment_date__isnull=False))
        result = []
        for offset in range(11, -1, -1):
            index = end.year * 12 + end.month - 1 - offset
            first = date(index // 12, index % 12 + 1, 1)
            last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            # 진행 중인 달은 권역 현지의 오늘까지 집계합니다.
            cutoff = min(last, local_today(country or 'KR'))
            entries = sum(first <= row.deployment_date <= cutoff for row in known)
            exits = sum(bool(row.resignation_date and first <= row.resignation_date <= cutoff) for row in known)
            count = sum(row.deployment_date <= cutoff and (not row.resignation_date or row.resignation_date > cutoff) for row in known)
            result.append({'month': first.strftime('%Y-%m'), 'entries': entries, 'exits': exits, 'headcount': count, 'net': entries - exits})
        return Response({'months': result, 'missing_dates': missing, 'grouping': '현재 권역·소속사 기준',
                         'companies': list(StaffAssignment.objects.exclude(company_name='').order_by('company_name').values_list('company_name', flat=True).distinct())})
