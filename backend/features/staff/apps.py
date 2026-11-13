from django.apps import AppConfig


class StaffConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'features.staff'
    label = 'staff'
    verbose_name = '운영 인력'

    def ready(self):
        from . import signals  # noqa: F401
