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
