from django.conf import settings
from django.db import models
from django.db.models import Q


class RegionalHandover(models.Model):
    REGION_CHOICES = (("KR", "KR"), ("EU", "EU"), ("NA", "NA"))
    PRIORITY_NORMAL = "normal"
    PRIORITY_HIGH = "high"
    PRIORITY_CHOICES = (
        (PRIORITY_HIGH, "중요"),
        (PRIORITY_NORMAL, "일반"),
    )
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = (
        (STATUS_IN_PROGRESS, "진행 중"),
        (STATUS_COMPLETED, "완료"),
    )
    CATEGORY_CHOICES = (
        ("issue", "이슈"),
        ("notice", "공지"),
    )

    region = models.CharField(max_length=2, choices=REGION_CHOICES, db_index=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL, db_default=PRIORITY_NORMAL)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS, db_default=STATUS_IN_PROGRESS, db_index=True)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default="issue", db_default="issue")
    title = models.CharField(max_length=200)
    content_html = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_regional_handovers",
    )
    author_name = models.CharField(max_length=150)
    author_username = models.CharField(max_length=150, blank=True, default="", db_default="")
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now(), db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_default=models.functions.Now())

    class Meta:
        db_table = "ops_regional_handovers"
        db_table_comment = "권역별 상시 핸드오버 기록"
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=Q(region__in=["KR", "EU", "NA"]), name="regional_handover_valid_region"),
            models.CheckConstraint(condition=Q(priority__in=["normal", "high"]), name="regional_handover_valid_priority"),
            models.CheckConstraint(condition=Q(status__in=["in_progress", "completed"]), name="regional_handover_valid_status"),
            models.CheckConstraint(condition=Q(category__in=["issue", "notice"]), name="regional_handover_valid_category"),
        ]


class RegionalHandoverImage(models.Model):
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="regional_handover_images",
    )
    handover = models.ForeignKey(
        RegionalHandover,
        on_delete=models.CASCADE,
        related_name="images",
        null=True,
        blank=True,
    )
    file = models.ImageField(upload_to="regional_handovers/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True, default="", db_default="")
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now())

    class Meta:
        db_table = "ops_regional_handover_images"
        db_table_comment = "권역별 핸드오버 본문 이미지"
        ordering = ["created_at", "id"]
