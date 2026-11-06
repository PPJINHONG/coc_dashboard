from django.db import models
from django.db.models import Q

from reporting.models import StaffMember


class StaffAssignment(models.Model):
    country_code = models.CharField(max_length=2, choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')])
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())
    staff = models.ForeignKey(StaffMember, db_column='staff_member_id', on_delete=models.PROTECT)
    job_title = models.CharField(max_length=100)
    company_name = models.CharField(max_length=100)
    job_description = models.TextField(blank=True, default='', db_default='')
    work_location = models.CharField(max_length=150, blank=True, default='', db_default='')

    class Meta:
        db_table = 'ops_staff_assignments'
        db_table_comment = '현재 운영 인력 배치'
        ordering = ['country_code', 'staff__staff_name', 'id']
        constraints = [
            models.UniqueConstraint(fields=['staff'], name='unique_current_staff_assignment'),
            models.CheckConstraint(condition=Q(country_code__in=['KR', 'EU', 'NA']), name='current_staff_valid_country'),
        ]
