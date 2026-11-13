from django.db import models
from django.db.models import Q

from reporting.models import StaffMember


class StaffAssignment(models.Model):
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
        ]
