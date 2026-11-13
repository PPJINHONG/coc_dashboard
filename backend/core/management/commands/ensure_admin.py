from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from core.defaults import DEFAULT_ACCOUNTS
from core.roles import ROLE_ADMIN, apply_role
from core.signals import username_changed

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"
LEGACY_ADMIN_USERNAME = "admin@admin"


class Command(BaseCommand):
    help = "기본 관리자 admin 계정이 없을 때만 만듭니다. 이미 있으면 비밀번호를 포함해 아무것도 바꾸지 않습니다."

    def handle(self, *args, **options):
        self.ensure_admin()
        self.ensure_default_accounts()

    def ensure_default_accounts(self):
        """kr·eu·na(각 국가 그룹장), readonly(옵저버) 기본 계정을 없을 때만 만듭니다. 있는 계정은 그대로 둡니다."""
        User = get_user_model()
        with transaction.atomic():
            for username, password, name, role, countries in DEFAULT_ACCOUNTS:
                if username == ADMIN_USERNAME or User.objects.filter(username__iexact=username).exists():
                    continue
                user = User.objects.create(
                    username=username,
                    first_name=name,
                    password=make_password(password),
                    is_staff=role == ROLE_ADMIN,
                    is_active=True,
                )
                apply_role(user, role, countries)
                self.stdout.write(f"기본 계정 {username}({role})을 만들었습니다.")

    def ensure_admin(self):
        User = get_user_model()
        with transaction.atomic():
            if User.objects.filter(username__iexact=ADMIN_USERNAME).exists():
                return
            legacy = User.objects.select_for_update().filter(username__iexact=LEGACY_ADMIN_USERNAME).first()
            if legacy is not None:
                # 이전 기본 관리자(admin@admin)는 같은 계정 ID를 유지한 채 아이디만 바꿉니다.
                old = legacy.username
                legacy.username = ADMIN_USERNAME
                legacy.password = make_password(ADMIN_PASSWORD)
                legacy.is_staff = legacy.is_superuser = legacy.is_active = True
                legacy.save(update_fields=["username", "password", "is_staff", "is_superuser", "is_active"])
                # 작성자 아이디를 저장하는 기능(리전 이슈 등)이 새 아이디로 바꿉니다.
                username_changed.send(sender=User, old_username=old, new_username=ADMIN_USERNAME)
                self.stdout.write(f"기존 관리자 {old} 계정을 {ADMIN_USERNAME}(으)로 변경했습니다.")
                return
            User.objects.create(
                username=ADMIN_USERNAME,
                first_name="admin",
                password=make_password(ADMIN_PASSWORD),
                is_staff=True,
                is_superuser=True,
                is_active=True,
            )
            self.stdout.write("기본 관리자 admin 계정을 만들었습니다.")
