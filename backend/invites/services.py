from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Invite, InviteUse, hash_token, new_token

# 일반 팀원은 1일·10명 링크만, 관리자는 한 번에 많이 받을 수 있게 최대 30일·200명까지 만듭니다.
MEMBER_OPTIONS = {"expires_days": (1,), "max_uses": (10,), "default_expires_days": 1, "default_max_uses": 10}
STAFF_OPTIONS = {
    "expires_days": (1, 7, 30),
    "max_uses": (50, 100, 200),
    "default_expires_days": 7,
    "default_max_uses": 50,
}


def invite_options(user) -> dict:
    return STAFF_OPTIONS if user.is_staff else MEMBER_OPTIONS

STATUS_MESSAGES = {
    "missing": "초대 링크가 올바르지 않습니다. 링크를 다시 확인해 주세요.",
    "revoked": "취소된 초대 링크입니다. 팀원에게 새 링크를 받아 주세요.",
    "expired": "기간이 지난 초대 링크입니다. 팀원에게 새 링크를 받아 주세요.",
    "used_up": "가입 인원이 다 찬 초대 링크입니다. 팀원에게 새 링크를 받아 주세요.",
}
REQUIRED_MESSAGE = "회원가입은 초대 링크로만 할 수 있습니다. 팀원에게 초대 링크를 받아 열어 주세요."


def create_invite(user, expires_days: int, max_uses):
    token = new_token()
    invite = Invite.objects.create(
        token_hash=hash_token(token),
        token_hint=token[-4:],
        created_by=user,
        expires_at=timezone.now() + timedelta(days=expires_days),
        max_uses=max_uses,
    )
    return invite, token


def find_invite(token: str, *, lock: bool = False):
    """토큰에 맞는 초대를 찾고, 쓸 수 없으면 (None, 사유)를 돌려줍니다."""
    if not token or not isinstance(token, str) or len(token) > 128:
        return None, "missing"
    qs = Invite.objects.select_related("created_by")
    if lock:
        qs = qs.select_for_update(of=("self",))
    invite = qs.filter(token_hash=hash_token(token)).first()
    if invite is None:
        return None, "missing"
    state = invite.status()
    if state != "active":
        return None, state
    return invite, "active"


def invite_error(token) -> ValidationError | None:
    if not token:
        return ValidationError({"invite": [REQUIRED_MESSAGE]})
    _, state = find_invite(token)
    if state != "active":
        return ValidationError({"invite": [STATUS_MESSAGES[state]]})
    return None


def redeem_invite(token: str, user) -> Invite:
    """트랜잭션 안에서 호출합니다. 초대 행을 잠그고 사용 횟수를 올립니다."""
    invite, state = find_invite(token, lock=True)
    if invite is None:
        raise ValidationError({"invite": [STATUS_MESSAGES.get(state, REQUIRED_MESSAGE)]})
    invite.use_count += 1
    invite.save(update_fields=["use_count"])
    InviteUse.objects.create(invite=invite, user=user)
    return invite
