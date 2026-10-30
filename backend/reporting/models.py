from django.db import models
from django.db.models import F, Q


class Region(models.Model):
    region_name = models.CharField(max_length=80, unique=True)
    country_code = models.CharField(max_length=10, default='KR', db_default='KR')

    class Meta:
        db_table = 'ops_regions'
        db_table_comment = '리전 공통데이터'
        ordering = ['region_name', 'id']


class Service(models.Model):
    service_code = models.CharField(max_length=40, primary_key=True)
    service_name = models.CharField(max_length=80, unique=True)

    class Meta:
        db_table = 'ops_services'
        db_table_comment = '인프라 서비스 공통데이터'
        ordering = ['service_code']


class StaffMember(models.Model):
    staff_name = models.CharField(max_length=100)

    class Meta:
        db_table = 'ops_staff_members'
        db_table_comment = '운영 인력 공통데이터'
        ordering = ['staff_name', 'id']


class DataState(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    revision = models.PositiveIntegerField(default=0, db_default=0)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_data_state'
        db_table_comment = '운영 데이터 동시 수정 버전'
        constraints = [models.CheckConstraint(condition=Q(id=1), name='single_operations_state')]


class CurrentRow(models.Model):
    region = models.ForeignKey(Region, on_delete=models.PROTECT)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        abstract = True


class InfrastructureResource(CurrentRow):
    service = models.ForeignKey(Service, db_column='service_code', on_delete=models.PROTECT)
    environment_name = models.CharField(max_length=80, default='운영', db_default='운영')
    host_count = models.PositiveIntegerField(default=0, db_default=0)
    vm_count = models.PositiveIntegerField(null=True, blank=True)
    storage_count = models.PositiveIntegerField(null=True, blank=True)
    remarks = models.TextField(blank=True, default='', db_default='')

    class Meta:
        db_table = 'infra_resources'
        db_table_comment = '현재 인프라 자원: 리전·서비스·환경별 Host·VM·Storage 수량'
        ordering = ['region_id', 'service_id', 'environment_name', 'id']
        constraints = [models.UniqueConstraint(fields=['region', 'service', 'environment_name'], name='unique_current_resource_environment')]


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


class RegionalIssue(CurrentRow):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='', db_default='')
    severity = models.CharField(max_length=10, choices=[('critical', '긴급'), ('major', '높음'), ('minor', '보통'), ('info', '안내')], default='minor', db_default='minor')
    status = models.CharField(max_length=10, choices=[('open', '진행중'), ('blocked', '보류'), ('resolved', '완료')], default='open', db_default='open')
    progress_percent = models.PositiveSmallIntegerField(default=0, db_default=0)
    owner = models.ForeignKey(StaffMember, db_column='owner_staff_id', on_delete=models.PROTECT, null=True, blank=True)
    next_action = models.TextField(blank=True, default='', db_default='')
    # 화면에서 등록한 사용자. DB 관리에서 관리자가 입력한 행은 비어 있으며 관리자만 수정·삭제합니다.
    author_name = models.CharField(max_length=150, blank=True, default='', db_default='')
    author_username = models.CharField(max_length=150, blank=True, default='', db_default='')

    class Meta:
        db_table = 'ops_regional_issues'
        db_table_comment = '현재 리전별 운영 이슈·조치'
        ordering = ['-updated_at', '-id']
        constraints = [
            models.CheckConstraint(condition=Q(progress_percent__lte=100), name='issue_progress_max_100'),
            models.CheckConstraint(condition=Q(status__in=['open', 'blocked', 'resolved']), name='current_issue_valid_status'),
            models.CheckConstraint(condition=Q(severity__in=['critical', 'major', 'minor', 'info']), name='current_issue_valid_severity'),
            models.CheckConstraint(condition=~Q(status='resolved') | Q(progress_percent=100), name='resolved_issue_progress_100'),
        ]


class IssueComment(models.Model):
    issue = models.ForeignKey(RegionalIssue, on_delete=models.PROTECT, related_name='comments')
    author_name = models.CharField(max_length=150)
    author_username = models.CharField(max_length=150, blank=True, default='', db_default='')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_issue_comments'
        db_table_comment = '운영 이슈 댓글'
        ordering = ['created_at', 'id']


class ChangeLog(models.Model):
    section = models.CharField(max_length=30)
    action = models.CharField(max_length=30)
    actor_name = models.CharField(max_length=150)
    actor_username = models.CharField(max_length=150, blank=True, default='', db_default='')
    summary = models.CharField(max_length=300)
    before_data = models.JSONField(default=dict, db_default={})
    after_data = models.JSONField(default=dict, db_default={})
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ops_change_logs'
        db_table_comment = '운영 데이터 변경 이력'
        ordering = ['-created_at', '-id']


class NavigationPreference(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, null=True, blank=True)
    browser_key = models.UUIDField(unique=True, null=True, blank=True)
    hidden_tabs = models.JSONField(default=list, db_default=[])
    sidebar_collapsed = models.BooleanField(default=False, db_default=False)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'ui_navigation_preferences'
        db_table_comment = '사용자·브라우저별 탭 표시와 사이드바 설정'
        constraints = [models.CheckConstraint(
            condition=(Q(user__isnull=False, browser_key__isnull=True) | Q(user__isnull=True, browser_key__isnull=False)),
            name='navigation_preference_single_owner',
        )]
