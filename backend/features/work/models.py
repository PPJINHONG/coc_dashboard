from django.db import models
from django.db.models import F, Q

from reporting.models import CurrentRow


class WorkSummary(CurrentRow):
    work_type = models.CharField(max_length=10, choices=[('request', '요청작업'), ('change', '변경작업'), ('incident', '장애대응')])
    scope = models.CharField(max_length=15, choices=[('infra', '인프라'), ('automation', '자동화')], default='infra', db_default='infra')
    total_count = models.PositiveIntegerField(default=0, db_default=0)
    completed_count = models.PositiveIntegerField(default=0, db_default=0)
    batch_count = models.PositiveIntegerField(default=0, db_default=0)
    delayed_count = models.PositiveIntegerField(default=0, db_default=0)
    mttr_minutes = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    remarks = models.TextField(blank=True, default='', db_default='')

    class Meta:
        db_table = 'ops_work_summaries'
        db_table_comment = '현재 요청·변경·장애 작업 현황'
        ordering = ['work_type', 'region_id', 'scope', 'id']
        constraints = [
            models.UniqueConstraint(fields=['region', 'work_type', 'scope'], name='unique_current_work_scope'),
            models.CheckConstraint(condition=Q(work_type__in=['request', 'change', 'incident']), name='current_work_valid_type'),
            models.CheckConstraint(condition=Q(scope__in=['infra', 'automation']), name='current_work_valid_scope'),
            models.CheckConstraint(condition=Q(completed_count__lte=F('total_count')), name='work_completed_lte_total'),
            models.CheckConstraint(condition=Q(batch_count__lte=F('total_count')), name='work_batch_lte_total'),
            models.CheckConstraint(condition=Q(delayed_count__lte=F('total_count') - F('completed_count')), name='work_delayed_lte_remaining'),
            models.CheckConstraint(condition=Q(mttr_minutes__isnull=True) | Q(mttr_minutes__gte=0), name='work_mttr_nonnegative'),
        ]
