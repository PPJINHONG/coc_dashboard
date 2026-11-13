from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from reporting.models import month_first_day_check


class RegionalRequest(models.Model):
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_COMPLETED, "Completed"),
    ]
    TIMEZONE_CHOICES = [("UTC", "미국 (UTC)"), ("KST", "한국 (KST)"), ("CET", "유럽 (CET)")]
    REGION_CHOICES = (("KR", "KR"), ("NA", "NA"), ("EU", "EU"))
    ASSIGNEE_REGION_CHOICES = ("KR", "NA", "EU")

    period_month = models.DateField(db_index=True, db_comment="요청일 기준 월(그 달 1일)")
    region = models.CharField(max_length=2, choices=REGION_CHOICES)
    title = models.CharField(max_length=200)
    content_html = models.TextField()
    requester = models.CharField(max_length=200)
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    schedule_timezone = models.CharField(max_length=3, choices=TIMEZONE_CHOICES)
    schedule_start = models.DateTimeField(db_index=True)
    schedule_end = models.DateTimeField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_OPEN, db_default=STATUS_OPEN)
    assignee_regions = models.JSONField(default=list, db_default=[])
    assignee_name = models.CharField(max_length=200, blank=True, default="", db_default="")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_regional_requests",
    )
    author_name = models.CharField(max_length=150)
    author_username = models.CharField(max_length=150, blank=True, default="", db_default="")
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = "ops_regional_requests"
        db_table_comment = "요청일 기준 월별 권역 요청작업 티켓"
        ordering = ["-period_month", "schedule_start", "id"]
        constraints = [
            month_first_day_check("regional_request_month_first_day"),
            models.CheckConstraint(condition=Q(region__in=["KR", "NA", "EU"]), name="regional_request_valid_region"),
            models.CheckConstraint(condition=Q(schedule_end__gt=F("schedule_start")), name="regional_request_schedule_order"),
            models.CheckConstraint(condition=Q(status__in=["open", "in_progress", "completed"]), name="regional_request_valid_status"),
            models.CheckConstraint(condition=Q(schedule_timezone__in=["UTC", "KST", "CET"]), name="regional_request_valid_timezone"),
        ]


class RegionalRequestImage(models.Model):
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="regional_request_images",
    )
    request = models.ForeignKey(
        RegionalRequest,
        on_delete=models.CASCADE,
        related_name="images",
        null=True,
        blank=True,
    )
    file = models.ImageField(upload_to="regional_requests/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True, default="", db_default="")
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now())

    class Meta:
        db_table = "ops_regional_request_images"
        db_table_comment = "권역 요청작업 본문 이미지"
        ordering = ["created_at", "id"]
