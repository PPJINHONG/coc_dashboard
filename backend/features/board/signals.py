"""첨부 이미지 행이 삭제되면 저장소의 실제 파일도 지웁니다.

Post가 삭제되면 cascade로 PostImage도 삭제되고, 각 PostImage의 post_delete가 호출되어 파일이 지워집니다.
이미지만 단독 삭제(첨부 교체)해도 동일하게 동작합니다.
"""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PostImage


@receiver(post_delete, sender=PostImage)
def delete_image_file_on_delete(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)
