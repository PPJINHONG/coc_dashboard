from django.conf import settings
from django.db import models
from django.db.models import Q

from reporting.models import StaffMember


class StaffAssignment(models.Model):
    account = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name='staff_profile', db_comment='직접 연결한 회원 계정')
    deployment_date = models.DateField(null=True, blank=True, db_comment='운영 업무 투입일')
    resignation_date = models.DateField(null=True, blank=True, db_comment='회사 퇴사일 (마지막 재직일)')
    grade = models.CharField(max_length=2, blank=True, default='', db_default='', choices=[(f'L{i}', f'L{i}') for i in range(1, 5)])
    country_code = models.CharField(max_length=2, choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')])
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())
    staff = models.ForeignKey(StaffMember, db_column='staff_member_id', on_delete=models.PROTECT)
    # 직책·소속사는 모르는 경우가 있어 비워 둘 수 있습니다.
    job_title = models.CharField(max_length=100, blank=True, default='', db_default='')
    company_name = models.CharField(max_length=100, blank=True, default='', db_default='')
    job_description = models.TextField(blank=True, default='', db_default='')
    work_location = models.CharField(max_length=150, blank=True, default='', db_default='')
    # 접속·계정 정보. 형식이 제각각이므로(미확정 IP 포함) 문자열 그대로 저장합니다.
    pc_ip = models.CharField(max_length=45, blank=True, default='', db_default='', db_comment='PC IP')
    autoever_account = models.CharField(max_length=40, blank=True, default='', db_default='', db_comment='오토에버 계정')
    z_account = models.CharField(max_length=40, blank=True, default='', db_default='', db_comment='Z 계정')

    class Meta:
        db_table = 'ops_staff_assignments'
        db_table_comment = '현재 운영 인력 배치'
        ordering = ['country_code', 'staff__staff_name', 'id']
        constraints = [
            models.UniqueConstraint(fields=['staff'], name='unique_current_staff_assignment'),
            models.CheckConstraint(condition=Q(country_code__in=['KR', 'EU', 'NA']), name='current_staff_valid_country'),
            models.CheckConstraint(condition=Q(grade__in=['', 'L1', 'L2', 'L3', 'L4']), name='staff_valid_grade'),
            models.CheckConstraint(condition=Q(deployment_date__isnull=True) | Q(resignation_date__isnull=True) | Q(resignation_date__gte=models.F('deployment_date')), name='staff_valid_employment_dates'),
        ]


class StaffCalendarEvent(models.Model):
    assignment = models.ForeignKey(StaffAssignment, on_delete=models.PROTECT, related_name='calendar_events')
    country_code = models.CharField(max_length=2, choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')])
    kind = models.CharField(max_length=20, choices=[('leave', '휴가'), ('marriage_leave', '결혼휴가'), ('long_leave', '장기휴가')])
    title = models.CharField(max_length=100, blank=True, default='', db_default='')
    start_date = models.DateField()
    end_date = models.DateField()
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_staff_calendar_events'
        ordering = ['start_date', 'assignment__staff__staff_name', 'id']
        constraints = [
            models.CheckConstraint(condition=Q(end_date__gte=models.F('start_date')), name='staff_calendar_valid_dates'),
            models.CheckConstraint(condition=Q(country_code__in=['KR', 'EU', 'NA']), name='staff_calendar_valid_country'),
            models.CheckConstraint(condition=Q(kind__in=['leave', 'marriage_leave', 'long_leave']), name='staff_calendar_valid_kind'),
        ]


class StaffResponsibility(models.Model):
    country_code = models.CharField(max_length=2, primary_key=True, choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')])
    site_representative = models.ForeignKey(StaffAssignment, null=True, blank=True, on_delete=models.SET_NULL, related_name='represented_countries')
    team_lead = models.ForeignKey(StaffAssignment, null=True, blank=True, on_delete=models.SET_NULL, related_name='led_teams')
    group_lead = models.ForeignKey(StaffAssignment, null=True, blank=True, on_delete=models.SET_NULL, related_name='led_groups')
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_staff_responsibilities'
        ordering = ['country_code']
        constraints = [models.CheckConstraint(condition=Q(country_code__in=['KR', 'EU', 'NA']), name='staff_responsibility_valid_country')]


class StaffChoice(models.Model):
    kind = models.CharField(max_length=20, choices=[('company_name', '소속사'), ('work_location', '근무지')])
    country_code = models.CharField(max_length=2, blank=True, default='', db_default='')
    value = models.CharField(max_length=150)

    class Meta:
        db_table = 'ops_staff_choices'
        ordering = ['kind', 'country_code', 'value', 'id']
        constraints = [
            models.UniqueConstraint(fields=['kind', 'country_code', 'value'], name='unique_staff_choice'),
            models.CheckConstraint(condition=Q(kind__in=['company_name', 'work_location']), name='staff_choice_valid_kind'),
            models.CheckConstraint(condition=Q(country_code__in=['', 'KR', 'EU', 'NA']), name='staff_choice_valid_country'),
            models.CheckConstraint(condition=Q(kind='company_name', country_code='') | Q(kind='work_location', country_code__in=['KR', 'EU', 'NA']), name='staff_choice_country_scope'),
        ]
