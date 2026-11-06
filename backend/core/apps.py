from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # 로그인 행동 이력 신호를 등록합니다.
        from . import signals  # noqa: F401
