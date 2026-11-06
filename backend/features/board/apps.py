from django.apps import AppConfig


class BoardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "features.board"
    label = "board"
    verbose_name = "게시판"

    def ready(self):
        # 첨부 이미지 파일 삭제 신호를 등록합니다.
        from . import signals  # noqa: F401
