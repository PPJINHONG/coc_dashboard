from django.apps import AppConfig


class IssuesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "features.issues"
    label = "issues"
    verbose_name = "제거된 리전 이슈 마이그레이션"
