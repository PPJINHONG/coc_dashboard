"""모델 삭제 시 디스크의 실제 이미지 파일을 정리하는 시그널.

Post 가 삭제되면 cascade 로 PostImage 도 삭제되고, 각 PostImage 의 post_delete
가 호출되어 파일이 지워집니다. 이미지만 단독 삭제(첨부 교체)해도 동일하게 동작합니다.
"""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PostImage


@receiver(post_delete, sender=PostImage)
def delete_image_file_on_delete(sender, instance, **kwargs):
    """PostImage 레코드가 삭제되면 저장소의 파일도 삭제합니다."""
    if instance.file:
        instance.file.delete(save=False)


# === 로그인 행동 이력 ===
from django.contrib.auth import get_user_model  # noqa: E402
from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed  # noqa: E402


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
