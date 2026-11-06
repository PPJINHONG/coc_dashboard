from django.apps import AppConfig


class IssuesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'features.issues'
    label = 'issues'
    verbose_name = '리전 이슈'

    def ready(self):
        # 계정 아이디가 바뀌면 작성자 아이디를 함께 바꾸는 신호를 등록합니다.
        from . import signals  # noqa: F401
