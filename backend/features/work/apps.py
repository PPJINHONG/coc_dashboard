from django.apps import AppConfig


class WorkConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'features.work'
    label = 'work'
    verbose_name = '운영 작업'
