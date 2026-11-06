from django.apps import AppConfig


class ResourcesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'features.resources'
    label = 'resources'
    verbose_name = '인프라 자원'
