"""공통 계정 모델. 계정은 Django 기본 auth_user를 쓰고 여기에는 행동 이력만 둡니다."""

from django.conf import settings
from django.db import models


class UserActivity(models.Model):
    """사용자 행동 이력. 관리자가 사용자·권한 화면에서 계정별로 확인합니다.

    수정은 바뀐 항목의 이전 값·새 값(changes)을, 삭제는 지운 원본 전체(before_data)를 남깁니다.
    계정이 삭제되어도 이력은 username으로 남습니다.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )
    username = models.CharField(max_length=150)
    action = models.CharField(max_length=30)
    target_type = models.CharField(max_length=40, blank=True, default="")
    target_id = models.CharField(max_length=40, blank=True, default="")
    summary = models.CharField(max_length=300)
    before_data = models.JSONField(default=dict, blank=True)
    after_data = models.JSONField(default=dict, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_activity_logs"
        db_table_comment = "사용자 행동 이력: 로그인·등록·수정(이전값/새값)·삭제(원본)"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "-created_at"], name="user_activity_user_time")]
