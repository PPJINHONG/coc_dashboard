# 실행법: pytest --ds=config.settings core/tests
from io import StringIO

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient

CSRF_URL = "/api/auth/csrf/"
LOGIN_URL = "/api/auth/login/"
REGISTER_URL = "/api/auth/register/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/me/"
PASSWORD = "pass12345!"
NEW_PASSWORD = "Updated!93827"
PUBLIC_FIELDS = {"id", "name", "username", "email", "date_joined", "is_staff"}
INVITE = "test-invite-token-for-registration"


@pytest.fixture(autouse=True)
def registration_invite(db):
    # 회원가입은 초대 링크가 필요하므로 기간·횟수 제한 없는 테스트용 초대를 둡니다.
    from datetime import timedelta

    from django.utils import timezone

    from invites.models import Invite, hash_token

    return Invite.objects.create(
        token_hash=hash_token(INVITE), token_hint=INVITE[-4:],
        expires_at=timezone.now() + timedelta(days=1), max_uses=None,
    )


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(
        username="alice@example.com", password=PASSWORD,
        email="alice@example.com", first_name="Alice",
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    assert client.login(username=user.username, password=PASSWORD)
    return client


def _csrf_client():
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(CSRF_URL)
    assert response.status_code == 204
    assert "csrftoken" in client.cookies
    return client, client.cookies["csrftoken"].value


def _registration(**overrides):
    return {"name": "홍길동", "username": "member@example.com", "password": NEW_PASSWORD, "invite": INVITE, **overrides}


@pytest.mark.django_db
def test_registration_creates_regular_user_and_session():
    client, token = _csrf_client()
    response = client.post(
        REGISTER_URL, _registration(username=" Member@Example.com ", is_staff=True, is_superuser=True),
        format="json", HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 201
    assert set(response.data) == PUBLIC_FIELDS
    assert response.data["name"] == "홍길동"
    assert response.data["username"] == response.data["email"] == "member@example.com"
    saved = get_user_model().objects.get(username="member@example.com")
    assert saved.check_password(NEW_PASSWORD)
    assert saved.password != NEW_PASSWORD
    assert not saved.is_staff and not saved.is_superuser
    assert settings.SESSION_COOKIE_NAME in client.cookies
    assert client.get(ME_URL).data["id"] == saved.pk
    assert client.cookies["csrftoken"].value != token


@pytest.mark.django_db
@pytest.mark.parametrize("path", [LOGIN_URL, REGISTER_URL])
def test_anonymous_auth_post_requires_csrf(path):
    client = APIClient(enforce_csrf_checks=True)
    assert client.post(path, _registration(), format="json").status_code == 403
    client.get(CSRF_URL)
    assert client.post(path, _registration(), format="json").status_code == 403
    assert not get_user_model().objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("data, field", [
    (_registration(name="  "), "name"),
    (_registration(username="invalid"), "username"),
    (_registration(username="admin@admin"), "username"),
    (_registration(username="a b@example.com"), "username"),
    (_registration(password="short"), "password"),
    (_registration(password="123456789012"), "password"),
    (_registration(password="password"), "password"),
    ({"name": "홍길동", "username": "member@example.com"}, "password"),
    ({"username": "member@example.com", "password": NEW_PASSWORD}, "name"),
    ({"name": "홍길동", "password": NEW_PASSWORD}, "username"),
])
def test_registration_rejects_invalid_input_without_creating_user(data, field):
    response = APIClient().post(REGISTER_URL, data, format="json")
    assert response.status_code == 400
    assert field in response.data
    assert not get_user_model().objects.exists()


@pytest.mark.django_db
def test_registration_rejects_case_insensitive_duplicate(user):
    response = APIClient().post(REGISTER_URL, _registration(username="ALICE@EXAMPLE.COM"), format="json")
    assert response.status_code == 400
    assert "username" in response.data
    assert get_user_model().objects.count() == 1


@pytest.mark.django_db
def test_registration_respects_email_on_legacy_account(user):
    user.username = "legacy-alice"
    user.save()
    response = APIClient().post(REGISTER_URL, _registration(username=user.email), format="json")
    assert response.status_code == 400
    assert "username" in response.data


@pytest.mark.django_db
def test_login_success_creates_session(user):
    client, token = _csrf_client()
    response = client.post(
        LOGIN_URL, {"username": " ALICE@EXAMPLE.COM ", "password": PASSWORD},
        format="json", HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 200
    assert set(response.data) == PUBLIC_FIELDS
    assert response.data["username"] == user.username
    assert settings.SESSION_COOKIE_NAME in client.cookies
    assert client.get(ME_URL).data["id"] == user.pk


@pytest.mark.django_db
def test_legacy_username_can_still_log_in(user):
    user.username = "legacy-alice"
    user.save()
    response = APIClient().post(LOGIN_URL, {"username": user.username, "password": PASSWORD}, format="json")
    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("inactive", [False, True])
def test_login_rejects_wrong_password_or_inactive_user(user, inactive):
    if inactive:
        user.is_active = False
        user.save()
    client, token = _csrf_client()
    response = client.post(
        LOGIN_URL, {"username": user.username, "password": PASSWORD if inactive else "incorrect"},
        format="json", HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 401
    assert response.data["detail"] == "아이디 또는 비밀번호가 올바르지 않습니다."
    assert client.get(ME_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_me_requires_auth():
    client = APIClient()
    assert client.get(ME_URL).status_code in (401, 403)
    assert client.patch(ME_URL, {"name": "Changed"}, format="json").status_code in (401, 403)


@pytest.mark.django_db
def test_me_returns_own_info(auth_client, user):
    response = auth_client.get(ME_URL)
    assert response.status_code == 200
    assert set(response.data) == PUBLIC_FIELDS
    assert response.data["id"] == user.pk
    assert response.data["name"] == "Alice"
    assert response.data["username"] == response.data["email"] == "alice@example.com"
    assert response.data["date_joined"]


@pytest.mark.django_db
@pytest.mark.parametrize('changes', [
    {'name': 'Changed'}, {'username': 'new@example.com'}, {'password': NEW_PASSWORD},
    {'is_staff': True}, {'is_active': False},
])
def test_profile_is_readonly_outside_admin_database_settings(auth_client, user, changes):
    response = auth_client.patch(ME_URL, {**changes, 'current_password': PASSWORD}, format='json')
    assert response.status_code == 405
    user.refresh_from_db()
    assert user.first_name == 'Alice' and user.username == 'alice@example.com'
    assert user.is_active and not user.is_staff and user.check_password(PASSWORD)


@pytest.mark.django_db
def test_logout_ends_session(auth_client):
    assert auth_client.post(LOGOUT_URL).status_code == 204
    assert auth_client.get(ME_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_admin_command_creates_superuser_without_exposing_password(monkeypatch):
    monkeypatch.setattr("core.management.commands.create_admin.getpass.getpass", lambda prompt: PASSWORD)
    output = StringIO()
    call_command("create_admin", stdout=output)
    admin = get_user_model().objects.get(username="admin@admin")
    assert admin.email == "admin@admin"
    assert admin.first_name == "admin"
    assert admin.is_superuser and admin.is_staff and admin.is_active
    assert admin.check_password(PASSWORD)
    assert PASSWORD not in output.getvalue()
    client = APIClient()
    assert client.post(LOGIN_URL, {"username": "admin@admin", "password": PASSWORD}, format="json").status_code == 200
    assert client.patch(ME_URL, {"name": "관리자", "username": "admin@admin"}, format="json").status_code == 405
    with pytest.raises(CommandError, match="이미 존재"):
        call_command("create_admin", stdout=output)
    admin.refresh_from_db()
    assert admin.check_password(PASSWORD)


@pytest.mark.django_db
def test_admin_command_rejects_password_mismatch(monkeypatch):
    values = iter([PASSWORD, NEW_PASSWORD])
    monkeypatch.setattr("core.management.commands.create_admin.getpass.getpass", lambda prompt: next(values))
    with pytest.raises(CommandError, match="일치하지"):
        call_command("create_admin")
    assert not get_user_model().objects.exists()


@pytest.mark.django_db
def test_no_pending_migrations():
    call_command("makemigrations", "--check", "--dry-run")
