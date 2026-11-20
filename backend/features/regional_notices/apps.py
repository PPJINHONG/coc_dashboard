from django.apps import AppConfig


class RegionalNoticesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "features.regional_notices"
    label = "regional_notices"
    verbose_name = "권역별 작업공지"
