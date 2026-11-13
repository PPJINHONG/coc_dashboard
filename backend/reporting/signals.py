from django.dispatch import receiver

from core.signals import username_changed
from .models import ChangeLog


@receiver(username_changed)
def follow_username_change(sender, old_username, new_username, **kwargs):
    # 본인 이력 조회는 계정 아이디가 변경되어도 이어집니다.
    ChangeLog.objects.filter(actor_username__iexact=old_username).update(actor_username=new_username)
