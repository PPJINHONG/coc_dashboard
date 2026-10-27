from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo12345"


class Command(BaseCommand):
    help = "데모 계정(demo / demo12345)을 멱등하게 생성합니다. C10 수동 검증용."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DEMO_USERNAME,
            defaults={
                "email": "demo@example.com",
                "first_name": "데모",
                "last_name": "사용자",
            },
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"데모 계정을 생성했습니다: {DEMO_USERNAME}"))
        else:
            self.stdout.write(f"데모 계정이 이미 존재합니다: {DEMO_USERNAME}")
