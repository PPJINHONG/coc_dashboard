from datetime import timedelta
from io import StringIO

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from core.security import set_password_change_required
from features.staff.models import StaffAssignment
from invites.models import Invite, hash_token

CSRF_URL = "/api/auth/csrf/"
LOGIN_URL = "/api/auth/login/"
REGISTER_URL = "/api/auth/register/"
PASSWORD_URL = "/api/auth/password/"
ME_URL = "/api/me/"
INVITE = "test-invite-token-for-registration"
PUBLIC_FIELDS = {
    "id", "name", "username", "email", "date_joined", "is_staff", "role",
    "managed_countries", "staff_edit_countries", "must_change_password",
}


@pytest.fixture(autouse=True)
def registration_invite(db):
    return Invite.objects.create(
        token_hash=hash_token(INVITE),
        token_hint=INVITE[-4:],
        expires_at=timezone.now() + timedelta(days=1),
        max_uses=None,
    )


def registration(**values):
    return {"name": "홍길동", "email": "member@example.com", "password": "1234", "invite": INVITE, **values}


def csrf_client():
    client = APIClient(enforce_csrf_checks=True)
    assert client.get(CSRF_URL).status_code == 204
    return client, client.cookies["csrftoken"].value


@pytest.mark.django_db
def test_registration_uses_unique_name_login_and_does_not_create_staff():
    client, token = csrf_client()
    response = client.post(REGISTER_URL, registration(), format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 201, response.data
    assert set(response.data) == PUBLIC_FIELDS
    assert response.data["name"] == response.data["username"] == "홍길동"
    assert response.data["email"] == "member@example.com"
    assert response.data["role"] == "user" and not response.data["must_change_password"]
    user = get_user_model().objects.get(username="홍길동")
    assert user.check_password("1234") and not user.is_staff
    assert not StaffAssignment.objects.exists()
    assert client.get(ME_URL).data == response.data


@pytest.mark.django_db
@pytest.mark.parametrize("password,accepted", [("123", False), ("1234", True), ("abcd", True), ("!!!!", True)])
def test_password_policy_is_only_four_character_minimum(password, accepted):
    response = APIClient().post(REGISTER_URL, registration(password=password), format="json")
    assert response.status_code == (201 if accepted else 400)


@pytest.mark.django_db
def test_registration_rejects_duplicate_name_and_email_case_insensitively():
    get_user_model().objects.create_user(username="Alice", first_name="Alice", email="alice@example.com")
    duplicate_name = APIClient().post(REGISTER_URL, registration(name=" alice ", email="other@example.com"), format="json")
    duplicate_email = APIClient().post(REGISTER_URL, registration(name="Other", email="ALICE@EXAMPLE.COM"), format="json")
    assert duplicate_name.status_code == 400 and "name" in duplicate_name.data
    assert duplicate_email.status_code == 400 and "email" in duplicate_email.data


@pytest.mark.django_db
def test_login_uses_name_not_email_and_is_case_insensitive():
    user = get_user_model().objects.create_user(username="테스트책임", first_name="테스트책임", email="test@example.com", password="1234")
    client = APIClient()
    assert client.post(LOGIN_URL, {"username": " 테스트책임 ", "password": "1234"}, format="json").status_code == 200
    client.post("/api/auth/logout/")
    assert client.post(LOGIN_URL, {"username": "test@example.com", "password": "1234"}, format="json").status_code == 401
    assert user.pk


@pytest.mark.django_db
def test_initial_password_requires_change_and_blocks_other_apis():
    user = get_user_model().objects.create_user(username="초기회원", first_name="초기회원", email="initial@example.com", password="1111")
    set_password_change_required(user, True)
    client = APIClient()
    login = client.post(LOGIN_URL, {"username": "초기회원", "password": "1111"}, format="json")
    assert login.status_code == 200 and login.data["must_change_password"]
    assert client.get(ME_URL).status_code == 200
    blocked = client.get("/api/operations/current/")
    assert blocked.status_code == 403 and "새 비밀번호" in blocked.json()["detail"]
    assert client.post(PASSWORD_URL, {"password": "123", "confirm_password": "123"}, format="json").status_code == 400
    assert client.post(PASSWORD_URL, {"password": "abcd", "confirm_password": "nope"}, format="json").status_code == 400
    changed = client.post(PASSWORD_URL, {"password": "abcd", "confirm_password": "abcd"}, format="json")
    assert changed.status_code == 200 and not changed.data["must_change_password"]
    assert client.get("/api/operations/current/").status_code == 200
    client.post("/api/auth/logout/")
    assert client.post(LOGIN_URL, {"username": "초기회원", "password": "1111"}, format="json").status_code == 401
    assert client.post(LOGIN_URL, {"username": "초기회원", "password": "abcd"}, format="json").status_code == 200


@pytest.mark.django_db
def test_auth_posts_require_csrf():
    client = APIClient(enforce_csrf_checks=True)
    assert client.post(REGISTER_URL, registration(), format="json").status_code == 403
    client.get(CSRF_URL)
    assert client.post(REGISTER_URL, registration(), format="json").status_code == 403


@pytest.mark.django_db
def test_me_is_readonly():
    user = get_user_model().objects.create_user(username="읽기전용", first_name="읽기전용", email="readonly@example.com", password="1234")
    client = APIClient(); client.force_login(user)
    assert set(client.get(ME_URL).data) == PUBLIC_FIELDS
    assert client.patch(ME_URL, {"name": "변경"}, format="json").status_code == 405


@pytest.mark.django_db
def test_case_insensitive_database_indexes():
    get_user_model().objects.create_user(username="Unique", first_name="Unique", email="unique@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        get_user_model().objects.create_user(username="unique", first_name="Other", email="other@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        get_user_model().objects.create_user(username="Other", first_name="Other", email="UNIQUE@EXAMPLE.COM")


@pytest.mark.django_db
def test_ensure_admin_creates_only_admin_and_keeps_existing_password():
    call_command("ensure_admin", stdout=StringIO())
    assert list(get_user_model().objects.values_list("username", flat=True)) == ["admin"]
    admin = get_user_model().objects.get()
    assert admin.is_superuser and admin.is_staff and admin.check_password("admin")
    admin.set_password("keepme"); admin.save(update_fields=["password"])
    call_command("ensure_admin", stdout=StringIO())
    admin.refresh_from_db(); assert admin.check_password("keepme")


@pytest.mark.django_db
def test_no_pending_migrations():
    call_command("makemigrations", "--check", "--dry-run")
