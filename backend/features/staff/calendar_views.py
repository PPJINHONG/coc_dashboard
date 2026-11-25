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

from core.roles import is_admin, record_activity, staff_edit_countries
from reporting.history import capture_history
from reporting.months import parse_month
from reporting.services import lock_state, check_revision, bump, record_log
from .models import StaffAssignment, StaffCalendarEvent, StaffResponsibility, StaffColumn, StaffHeadcountRecord
from .permissions import owns_profile
from .serializers import CalendarSerializer, ResponsibilitySerializer, local_today
from .items import choice_rows, column_order, item_catalog


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
        if is_admin(request.user):
            accounts = [{'id': user.pk, 'name': user.get_full_name() or user.username, 'username': user.username, 'email': user.email}
                        for user in get_user_model().objects.filter(is_active=True).order_by('first_name', 'username')]
        return Response({
            'my_assignment': profile.pk if profile else None,
            'can_edit_calendar': bool(profile and owns_profile(request.user, profile)),
            'can_manage_choices': is_admin(request.user),
            'choices': choice_rows(),
            'items': item_catalog(), 'column_order': column_order(),
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
        if 'site_representative' in raw and not is_admin(request.user):
            raise PermissionDenied('현장대리인은 관리자만 지정할 수 있습니다.')
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        capture_history(request, 'staff')
        instance = StaffResponsibility.objects.filter(pk=raw['country_code']).first()
        before = dict(ResponsibilitySerializer(instance).data) if instance else None
        serializer = ResponsibilitySerializer(instance, data=raw, partial=instance is not None)
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
        company_column = StaffColumn.objects.filter(label__iexact='소속사').first()
        rows = StaffAssignment.objects.all()
        if country:
            rows = rows.filter(country_code=country)
        if company:
            if company_column is None:
                rows = rows.none()
            else:
                rows = rows.filter(**{f'custom_values__{company_column.key}': company})
        people = list(rows.values_list('hire_date', 'resignation_date', 'deployment_date', 'assignment_end_date'))
        missing = sum(deployment is None for _, _, deployment, _ in people)
        today = local_today(country or 'KR')
        # 월별 인원 기록이 있는 달은 기록값을 씁니다. 기록에는 소속사 구분이 없으므로 소속사 필터에서는 쓰지 않습니다.
        records = {}
        if not company:
            for record in StaffHeadcountRecord.objects.filter(**({'country_code': country} if country else {})):
                total = records.setdefault(record.period_month, [0, 0, 0])
                total[0] += record.headcount
                total[1] += record.entries
                total[2] += record.exits
        result = []
        for offset in range(11, -1, -1):
            index = end.year * 12 + end.month - 1 - offset
            first = date(index // 12, index % 12 + 1, 1)
            last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            cutoff = min(last, today)
            hires, resignations, deployments, assignment_ends, headcount = 0, 0, 0, 0, 0
            for hire, resignation, deployment, assignment_end in people:
                hires += bool(hire and first <= hire <= cutoff)
                resignations += bool(resignation and first <= resignation <= cutoff)
                deployments += bool(deployment and first <= deployment <= cutoff)
                assignment_ends += bool(assignment_end and first <= assignment_end <= cutoff)
                headcount += bool(deployment and deployment <= cutoff
                                  and (not resignation or resignation > cutoff)
                                  and (not assignment_end or assignment_end > cutoff))
            recorded = first in records
            count, entries, exits = records.get(first, (headcount, deployments, resignations))
            result.append({
                'month': first.strftime('%Y-%m'), 'headcount': count, 'recorded': recorded,
                'hires': hires, 'resignations': resignations, 'deployments': deployments,
                'assignment_ends': assignment_ends, 'future': first > today and not recorded,
                'entries': entries, 'exits': exits, 'net': entries - exits,
            })
        companies = []
        if company_column is not None:
            companies = sorted({
                str(values.get(company_column.key))
                for values in StaffAssignment.objects.values_list('custom_values', flat=True)
                if values.get(company_column.key)
            })
        return Response({'months': result, 'missing_dates': missing, 'grouping': '현재 권역·소속사 기준',
                         'companies': companies})
