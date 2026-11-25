from django.apps import AppConfig


class RegionalHandoversConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "features.regional_handovers"
    label = "regional_handovers"
    verbose_name = "권역별 핸드오버"

    def ready(self):
        from . import signals  # noqa: F401
