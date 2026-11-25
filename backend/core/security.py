from django.contrib.sessions.models import Session
from django.utils import timezone

from .models import AccountSecurity


INITIAL_PASSWORD = "1111"
PASSWORD_MIN_LENGTH = 4
FORCE_CHANGE_MESSAGE = "초기 비밀번호를 새 비밀번호로 변경해 주세요."


def must_change_password(user):
    if not user or not user.is_authenticated:
        return False
    try:
        return user.security_settings.must_change_password
    except AccountSecurity.DoesNotExist:
        return False


def set_password_change_required(user, required=True):
    security, _ = AccountSecurity.objects.get_or_create(user=user)
    security.must_change_password = required
    security.password_reset_at = timezone.now() if required else None
    security.save(update_fields=["must_change_password", "password_reset_at"])
    return security


def invalidate_user_sessions(user, keep_session_key=None):
    for session in Session.objects.all():
        if keep_session_key and session.session_key == keep_session_key:
            continue
        try:
            user_id = session.get_decoded().get("_auth_user_id")
        except Exception:
            continue
        if str(user_id) == str(user.pk):
            session.delete()
