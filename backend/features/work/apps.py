from django.apps import AppConfig


class WorkConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'features.work'
    label = 'work'
    verbose_name = '제거된 운영 작업 마이그레이션'
