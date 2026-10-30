import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "관리자 계정을 생성합니다. 비밀번호는 화면에 표시하거나 인수에 저장하지 않습니다."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin@admin")
        parser.add_argument("--name", default="admin")

    def handle(self, *args, **options):
        username = options["username"].strip().lower()
        name = options["name"].strip()
        if not name or len(name) > 150:
            raise CommandError("이름은 1~150자로 입력해 주세요.")
        if username != "admin@admin":
            from django.core.validators import validate_email

            try:
                validate_email(username)
            except ValidationError as exc:
                raise CommandError("이메일 형식의 아이디를 입력해 주세요.") from exc
        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError("이미 존재하는 아이디입니다. 기존 계정은 변경하지 않았습니다.")
        if User.objects.filter(email__iexact=username).exists():
            raise CommandError("이 이메일을 사용하는 기존 계정이 있습니다.")
        password = getpass.getpass("관리자 비밀번호: ")
        confirmation = getpass.getpass("관리자 비밀번호 확인: ")
        if password != confirmation:
            raise CommandError("비밀번호가 일치하지 않습니다.")
        candidate = User(username=username, email=username, first_name=name)
        try:
            validate_password(password, user=candidate)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc
        with transaction.atomic():
            User.objects.create_superuser(username=username, email=username, first_name=name, password=password)
        self.stdout.write(self.style.SUCCESS("관리자 계정을 생성했습니다."))
