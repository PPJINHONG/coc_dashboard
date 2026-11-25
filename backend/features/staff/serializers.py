from datetime import datetime, time
from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework import serializers

from reporting.serializers import RowSerializer

from .models import StaffAssignment, StaffCalendarEvent, StaffResponsibility
from .permissions import can_edit_person, can_manage_person, owns_profile
from .items import validate_custom_values
from .dates import DATE_LABELS, validate_staff_dates
from core.roles import is_admin, user_role, staff_edit_countries


EDIT_FIELDS = ['country_code', 'job_title', 'job_description', 'pc_ip', 'autoever_account', 'z_account',
               'account', *DATE_LABELS, 'custom_values']
SELF_FIELDS = {'staff_name', 'job_description', 'pc_ip', 'autoever_account', 'z_account', 'custom_values'}
TIMEZONES = {'KR': 'Asia/Seoul', 'NA': 'America/Los_Angeles', 'EU': 'Europe/Berlin'}
DOMAINS = {'KR': '내수', 'NA': '북미', 'EU': '유럽'}


# 권역 설정에 근무 시간이 없을 때의 기본값(KST)
DEFAULT_HOURS = (time(9), time(18))


def local_now(country):
    return timezone.now().astimezone(ZoneInfo(TIMEZONES[country]))


def local_today(country):
    return local_now(country).date()


def local_now_for(country):
    now, today = local_now(country), local_today(country)
    return now if now.date() == today else datetime.combine(today, now.time(), now.tzinfo)


def on_duty(start, end, moment):
    # 퇴근 시간이 출근 시간보다 이르면 자정을 넘기는 근무로 봅니다.
    return start <= moment < end if start < end else (moment >= start or moment < end)


class StaffSerializer(RowSerializer):
    """DB 관리 일괄 저장과 조회 응답. can_edit는 조회한 사용자가 운영 인력 탭에서 이 행을 편집할 수 있는지입니다."""

    retired_fields = ('region', 'role', 'status', 'work_mode', 'remarks')

    staff_name = serializers.CharField(source='staff.staff_name', read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    global_region = serializers.SerializerMethodField()
    employment_status = serializers.SerializerMethodField()
    current_status = serializers.SerializerMethodField()
    work_status = serializers.SerializerMethodField()
    status_detail = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    is_site_representative = serializers.SerializerMethodField()
    display_role = serializers.SerializerMethodField()
    can_set_site_representative = serializers.SerializerMethodField()

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'country_code', 'staff', 'staff_name', 'job_title', 'job_description',
                  'pc_ip', 'autoever_account', 'z_account', 'can_edit', 'can_manage', 'account', 'account_name',
                  *DATE_LABELS, 'global_region', 'employment_status', 'current_status',
                  'work_status', 'status_detail', 'custom_values', 'is_site_representative', 'display_role', 'can_set_site_representative']

    def validate(self, attrs):
        # 일괄 저장은 인력 ID 또는 공통 인력 키로 기존 행을 갱신합니다.
        instance = StaffAssignment.objects.filter(pk=attrs['id']).first() if 'id' in attrs else StaffAssignment.objects.filter(staff=attrs['staff']).first()
        validate_staff_dates(attrs, instance)
        return attrs

    def get_can_manage(self, obj):
        request = self.context.get('request')
        return bool(request and can_manage_person(request.user, obj))

    def get_is_site_representative(self, obj):
        if '_site_representatives' not in self.context:
            self.context['_site_representatives'] = dict(StaffResponsibility.objects.values_list('country_code', 'site_representative_id'))
        return self.context['_site_representatives'].get(obj.country_code) == obj.pk

    def get_display_role(self, obj):
        role = user_role(obj.account) if obj.account_id else 'user'
        titled = {'팀장': 'team_lead', '그룹장': 'group_lead', '책임': 'user', '관리자': 'admin'}.get(obj.job_title, role or 'user')
        # 권역 카드에서 팀장·그룹장으로 지정된 사람은 직책이 비어 있어도 그 역할로 표시합니다. 더 높은 쪽을 씁니다.
        if '_leads' not in self.context:
            leads = {}
            for team, group in StaffResponsibility.objects.values_list('team_lead_id', 'group_lead_id'):
                if group:
                    leads.setdefault(group, 'group_lead')
                if team:
                    leads[team] = 'team_lead'
            self.context['_leads'] = leads
        assigned = self.context['_leads'].get(obj.pk)
        rank = ['user', 'group_lead', 'team_lead', 'admin']
        return max(titled, assigned or 'user', key=lambda value: rank.index(value) if value in rank else 0)

    def get_can_set_site_representative(self, obj):
        # 현장대리인 지정은 관리자만 정보 수정 화면에서 합니다.
        request = self.context.get('request')
        return bool(request and is_admin(request.user))

    def get_global_region(self, obj):
        return DOMAINS[obj.country_code]

    def get_employment_status(self, obj):
        return 'retired' if obj.resignation_date and obj.resignation_date < local_today(obj.country_code) else 'employed'

    def work_state(self, obj):
        """권역 현지 날짜·시각과 권역 근무 시간으로 계산한 상태. 실제 출퇴근 기록이 아니라 근무 시간표 기준입니다."""
        cache = self.context.setdefault('_work_states', {})
        if obj.pk not in cache:
            today = local_today(obj.country_code)
            event = next((item for item in obj.calendar_events.all() if item.start_date <= today <= item.end_date), None)
            if self.get_employment_status(obj) == 'retired':
                state = ('retired', '퇴사', f'{obj.resignation_date} 퇴사')
            elif obj.deployment_date and obj.deployment_date > today:
                state = ('planned', '투입 예정', f'{obj.deployment_date} 업무 투입')
            elif event:
                state = ('leave', event.get_kind_display(), f'{event.get_kind_display()} · {event.start_date} ~ {event.end_date}')
            else:
                if '_hours' not in self.context:
                    self.context['_hours'] = {row.country_code: (row.work_start, row.work_end) for row in StaffResponsibility.objects.all()}
                start, end = self.context['_hours'].get(obj.country_code, (None, None))
                registered = bool(start and end)
                start, end = (start, end) if registered else DEFAULT_HOURS
                # 근무 시간은 권역 교대(KR → EU → NA)에 맞춰 한국 시간(KST)으로 정합니다. 주말은 권역 현지 요일로 봅니다.
                kst, local = local_now('KR'), local_now_for(obj.country_code)
                hours = f"{start:%H:%M}~{end:%H:%M} KST{'' if registered else ' (기본값)'}"
                if local.weekday() >= 5:
                    state = ('off_duty', '퇴근', f'현지 주말 · 근무 {hours}')
                elif on_duty(start, end, kst.time()):
                    state = ('on_duty', '출근', f'근무 {hours} · 현재 {kst:%H:%M} KST')
                else:
                    state = ('off_duty', '퇴근', f'근무 {hours} · 현재 {kst:%H:%M} KST')
            cache[obj.pk] = state
        return cache[obj.pk]

    def get_work_status(self, obj):
        return self.work_state(obj)[0]

    def get_current_status(self, obj):
        return self.work_state(obj)[1]

    def get_status_detail(self, obj):
        return self.work_state(obj)[2]

    def get_account_name(self, obj):
        return (obj.account.get_full_name() or obj.account.username) if obj.account else ''

    def get_can_edit(self, obj):
        request = self.context.get('request')
        return bool(request and can_edit_person(request.user, obj))


class StaffEditSerializer(RowSerializer):
    """운영 인력 탭 편집. 성명은 공통데이터(인력)를 고르지 않고 이름으로 입력합니다."""

    retired_fields = ('region', 'role', 'status', 'work_mode', 'remarks', 'staff')
    staff_name = serializers.CharField(max_length=100, trim_whitespace=True)

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'staff_name', *EDIT_FIELDS]

    def validate(self, attrs):
        instance = self.instance
        if instance is None and 'id' in attrs:
            instance = StaffAssignment.objects.filter(pk=attrs['id']).first()
        validate_staff_dates(attrs, instance)
        if 'custom_values' in attrs:
            attrs['custom_values'] = validate_custom_values(attrs['custom_values'], instance)
        return attrs


class CalendarSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='assignment.staff.staff_name', read_only=True)
    country_code = serializers.CharField(source='assignment.country_code', read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = StaffCalendarEvent
        fields = ['id', 'assignment', 'staff_name', 'country_code', 'kind', 'title', 'start_date', 'end_date', 'updated_at', 'can_edit']
        read_only_fields = ['id', 'assignment', 'country_code', 'updated_at', 'can_edit']

    def get_can_edit(self, obj):
        request = self.context.get('request')
        return bool(request and owns_profile(request.user, obj.assignment))

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and start > end:
            raise serializers.ValidationError('종료일은 시작일보다 빠를 수 없습니다.')
        return attrs


class ResponsibilitySerializer(serializers.ModelSerializer):
    site_representative_name = serializers.CharField(source='site_representative.staff.staff_name', read_only=True, default='')
    team_lead_name = serializers.CharField(source='team_lead.staff.staff_name', read_only=True, default='')
    group_lead_name = serializers.CharField(source='group_lead.staff.staff_name', read_only=True, default='')

    class Meta:
        model = StaffResponsibility
        fields = ['country_code', 'site_representative', 'site_representative_name', 'team_lead', 'team_lead_name', 'group_lead', 'group_lead_name', 'work_start', 'work_end']
        extra_kwargs = {'country_code': {'validators': []}}

    def validate(self, attrs):
        country = attrs.get('country_code', getattr(self.instance, 'country_code', None))
        for field in ('site_representative', 'group_lead'):
            person = attrs.get(field)
            if person and person.country_code != country:
                raise serializers.ValidationError({field: '같은 권역의 인력을 지정하세요.'})
        start = attrs.get('work_start', getattr(self.instance, 'work_start', None))
        end = attrs.get('work_end', getattr(self.instance, 'work_end', None))
        if bool(start) != bool(end) or (start and start == end):
            raise serializers.ValidationError({'work_start': '출근·퇴근 시간을 함께, 서로 다르게 입력하세요.'})
        return attrs
