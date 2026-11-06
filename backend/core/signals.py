"""계정 공통 신호: 로그인 행동 이력 기록, 아이디 변경 알림."""

from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import Signal, receiver

# 계정 아이디가 바뀌면 보냅니다(old_username, new_username).
# 작성자 아이디를 저장하는 기능 앱이 받아서 자기 데이터를 새 아이디로 바꿉니다. 예: features/issues/signals.py
username_changed = Signal()


@receiver(user_logged_in)
def record_login(sender, request, user, **kwargs):
    from .roles import record_activity

    record_activity(request, "login", "로그인", target_type="session", user=user)


@receiver(user_logged_out)
def record_logout(sender, request, user, **kwargs):
    from .roles import record_activity

    if user is not None:
        record_activity(request, "logout", "로그아웃", target_type="session", user=user)


@receiver(user_login_failed)
def record_login_failed(sender, credentials, request=None, **kwargs):
    from .roles import record_activity

    username = str(credentials.get("username", ""))[:150]
    user = get_user_model().objects.filter(username__iexact=username).first()
    if user is not None:
        record_activity(request, "login_failed", "로그인 실패(비밀번호 불일치)", target_type="session", user=user)
