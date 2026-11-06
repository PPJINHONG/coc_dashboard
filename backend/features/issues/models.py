from django.db import models
from django.db.models import Q

from reporting.models import CurrentRow, StaffMember


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
