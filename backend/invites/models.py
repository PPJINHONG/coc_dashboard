import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def hash_token(token: str) -> str:
    """초대 토큰은 원문 대신 SHA-256 해시로만 저장합니다."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(24)


class Invite(models.Model):
    """팀원이 발급하는 가입 초대 링크입니다. 링크를 받은 사람만 회원가입할 수 있습니다."""

    token_hash = models.CharField(max_length=64, unique=True)
    # 링크 목록에서 구분용으로 보여 주는 토큰 끝 4자리입니다.
    token_hint = models.CharField(max_length=8)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="invites_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    # None이면 기간 안에서 사용 횟수 제한이 없습니다.
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    use_count = models.PositiveIntegerField(default=0)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "auth_invites"
        ordering = ("-created_at", "-id")

    def status(self, now=None) -> str:
        now = now or timezone.now()
        if self.revoked_at:
            return "revoked"
        if self.expires_at <= now:
            return "expired"
        if self.max_uses is not None and self.use_count >= self.max_uses:
            return "used_up"
        return "active"


class InviteUse(models.Model):
    """어떤 초대 링크로 누가 가입했는지 남깁니다."""

    invite = models.ForeignKey(Invite, on_delete=models.CASCADE, related_name="uses")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="invite_use")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auth_invite_uses"
        ordering = ("created_at", "id")
