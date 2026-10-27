from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # 파일 삭제 시그널을 등록합니다.
        from . import signals  # noqa: F401
