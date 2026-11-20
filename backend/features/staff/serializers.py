from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework import serializers

from reporting.serializers import RowSerializer

from .models import StaffAssignment, StaffCalendarEvent, StaffResponsibility, StaffChoice
from .permissions import can_edit_person, can_manage_person, can_view_grade, owns_profile
from .items import BASE_GRADES, validate_custom_values
from core.roles import user_role, staff_edit_countries


EDIT_FIELDS = ['country_code', 'job_title', 'company_name', 'job_description', 'work_location', 'pc_ip', 'autoever_account', 'z_account',
               'account', 'deployment_date', 'resignation_date', 'grade', 'custom_values']
SELF_FIELDS = {'staff_name', 'job_description', 'work_location', 'pc_ip', 'autoever_account', 'z_account'}
TIMEZONES = {'KR': 'Asia/Seoul', 'NA': 'America/Los_Angeles', 'EU': 'Europe/Berlin'}
DOMAINS = {'KR': '내수', 'NA': '북미', 'EU': '유럽'}


def local_today(country):
    return timezone.now().astimezone(ZoneInfo(TIMEZONES[country])).date()


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
        fields = ['id', 'country_code', 'staff', 'staff_name', 'job_title', 'company_name', 'job_description', 'work_location',
                  'pc_ip', 'autoever_account', 'z_account', 'can_edit', 'can_manage', 'account', 'account_name',
                  'deployment_date', 'resignation_date', 'grade', 'global_region', 'employment_status', 'current_status',
                  'work_status', 'status_detail', 'custom_values', 'is_site_representative', 'display_role', 'can_set_site_representative']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not request or not can_view_grade(request.user):
            data.pop('grade', None)
        return data

    def get_can_manage(self, obj):
        request = self.context.get('request')
        return bool(request and can_manage_person(request.user, obj))

    def get_is_site_representative(self, obj):
        if '_site_representatives' not in self.context:
            self.context['_site_representatives'] = dict(StaffResponsibility.objects.values_list('country_code', 'site_representative_id'))
        return self.context['_site_representatives'].get(obj.country_code) == obj.pk

    def get_display_role(self, obj):
        role = user_role(obj.account) if obj.account_id else None
        if role == 'observer' or obj.job_title == '옵저버':
            return 'observer'
        return {'팀장': 'team_lead', '그룹장': 'group_lead', '책임': 'user', '관리자': 'admin'}.get(obj.job_title, role or 'user')

    def get_can_set_site_representative(self, obj):
        request = self.context.get('request')
        return bool(request and obj.country_code in staff_edit_countries(request.user))

    def get_global_region(self, obj):
        return DOMAINS[obj.country_code]

    def get_employment_status(self, obj):
        return 'retired' if obj.resignation_date and obj.resignation_date < local_today(obj.country_code) else 'employed'

    def work_state(self, obj):
        """오늘(권역 현지 날짜)의 근무 상태. 출근 기록이 없으므로 근무중이 아니라 근무 예정으로만 추정합니다."""
        cache = self.context.setdefault('_work_states', {})
        if obj.pk not in cache:
            today = local_today(obj.country_code)
            event = next((item for item in obj.calendar_events.all() if item.start_date <= today <= item.end_date), None)
            if self.get_employment_status(obj) == 'retired':
                state = ('retired', '퇴사', f'{obj.resignation_date} 퇴사')
            elif obj.deployment_date and obj.deployment_date > today:
                state = ('off', '휴무', f'{obj.deployment_date} 업무 투입 예정')
            elif event:
                state = ('leave', event.get_kind_display(), f'{event.get_kind_display()} · {event.start_date} ~ {event.end_date}')
            elif today.weekday() >= 5:
                state = ('off', '휴무', '현지 주말')
            else:
                state = ('scheduled', '근무 예정', '현지 평일 · 출근 기록 없음')
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
        start = attrs.get('deployment_date', getattr(self.instance, 'deployment_date', None))
        end = attrs.get('resignation_date', getattr(self.instance, 'resignation_date', None))
        if start and end and start > end:
            raise serializers.ValidationError('회사 퇴사일은 업무 투입일보다 빠를 수 없습니다.')
        if 'grade' in attrs:
            grade = attrs['grade'].strip()
            old = self.instance.grade if self.instance else ''
            if grade and grade not in BASE_GRADES and grade != old and not StaffChoice.objects.filter(kind='grade', value=grade).exists():
                raise serializers.ValidationError({'grade': '등록된 등급 항목을 선택하세요.'})
            attrs['grade'] = grade
        if 'custom_values' in attrs:
            attrs['custom_values'] = validate_custom_values(attrs['custom_values'], self.instance)
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
        fields = ['country_code', 'site_representative', 'site_representative_name', 'team_lead', 'team_lead_name', 'group_lead', 'group_lead_name']
        extra_kwargs = {'country_code': {'validators': []}}

    def validate(self, attrs):
        country = attrs.get('country_code', getattr(self.instance, 'country_code', None))
        for field in ('site_representative', 'group_lead'):
            person = attrs.get(field)
            if person and person.country_code != country:
                raise serializers.ValidationError({field: '같은 권역의 인력을 지정하세요.'})
        return attrs
