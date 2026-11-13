from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework import serializers

from reporting.serializers import RowSerializer

from .models import StaffAssignment, StaffCalendarEvent, StaffResponsibility
from .permissions import can_edit_person, can_manage_person, can_view_grade, owns_profile


EDIT_FIELDS = ['country_code', 'job_title', 'company_name', 'job_description', 'work_location', 'pc_ip', 'autoever_account', 'z_account',
               'account', 'deployment_date', 'resignation_date', 'grade']
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
    account_name = serializers.SerializerMethodField()

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'country_code', 'staff', 'staff_name', 'job_title', 'company_name', 'job_description', 'work_location',
                  'pc_ip', 'autoever_account', 'z_account', 'can_edit', 'can_manage', 'account', 'account_name',
                  'deployment_date', 'resignation_date', 'grade', 'global_region', 'employment_status', 'current_status']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not request or not can_view_grade(request.user):
            data.pop('grade', None)
        return data

    def get_can_manage(self, obj):
        request = self.context.get('request')
        return bool(request and can_manage_person(request.user, obj))

    def get_global_region(self, obj):
        return DOMAINS[obj.country_code]

    def get_employment_status(self, obj):
        return 'retired' if obj.resignation_date and obj.resignation_date < local_today(obj.country_code) else 'employed'

    def get_current_status(self, obj):
        if self.get_employment_status(obj) == 'retired':
            return '퇴사'
        today = local_today(obj.country_code)
        for event in obj.calendar_events.all():
            if event.start_date <= today <= event.end_date:
                return event.get_kind_display()
        return '근무'

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
