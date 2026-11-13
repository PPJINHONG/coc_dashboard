from django.apps import AppConfig


class RegionalRequestsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "features.regional_requests"
    label = "regional_requests"
    verbose_name = "권역별 요청작업"

    def ready(self):
        from . import signals  # noqa: F401
