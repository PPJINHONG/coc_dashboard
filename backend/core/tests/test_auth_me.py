# 실행법: cd backend && pytest --ds=config.settings core/tests
# pytest.ini가 없으므로 --ds 옵션으로 설정 모듈을 지정합니다. PostgreSQL 연결이 필요합니다.
import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient

CSRF_URL = "/api/auth/csrf/"
LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/me/"
PASSWORD = "pass12345!"
LOGIN_FAIL_DETAIL = "아이디 또는 비밀번호가 올바르지 않습니다."


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(
        username="alice",
        password=PASSWORD,
        email="alice@example.com",
        first_name="Alice",
        last_name="Kim",
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    client = APIClient()
    assert client.login(username=user.username, password=PASSWORD)
    return client


def _csrf_client():
    # CSRF 검증을 강제하는 클라이언트와 발급받은 토큰을 돌려줍니다.
    client = APIClient(enforce_csrf_checks=True)
    resp = client.get(CSRF_URL)
    assert resp.status_code == 204
    assert "csrftoken" in client.cookies
    return client, client.cookies["csrftoken"].value


@pytest.mark.django_db
def test_login_success_creates_session(user):
    client, token = _csrf_client()
    resp = client.post(
        LOGIN_URL,
        {"username": user.username, "password": PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert resp.status_code == 200
    assert resp.data["username"] == user.username
    assert "password" not in resp.data
    assert settings.SESSION_COOKIE_NAME in client.cookies
    me = client.get(ME_URL)
    assert me.status_code == 200
    assert me.data["username"] == user.username


@pytest.mark.django_db
def test_login_wrong_password_fails(user):
    client, token = _csrf_client()
    resp = client.post(
        LOGIN_URL,
        {"username": user.username, "password": "wrong-password"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert resp.status_code == 401
    assert resp.data["detail"] == LOGIN_FAIL_DETAIL
    assert client.get(ME_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_me_requires_auth(api_client):
    resp = api_client.get(ME_URL)
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_me_returns_own_info(auth_client, user):
    resp = auth_client.get(ME_URL)
    assert resp.status_code == 200
    assert set(resp.data.keys()) == {"username", "first_name", "last_name", "email", "date_joined"}
    assert resp.data["username"] == "alice"
    assert resp.data["first_name"] == "Alice"
    assert resp.data["last_name"] == "Kim"
    assert resp.data["email"] == "alice@example.com"
    assert resp.data["date_joined"]


@pytest.mark.django_db
def test_patch_me_updates_name_email(auth_client, user):
    resp = auth_client.patch(
        ME_URL,
        {"first_name": "길동", "last_name": "홍", "email": "hong@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["email"] == "hong@example.com"
    user.refresh_from_db()
    assert user.first_name == "길동"
    assert user.last_name == "홍"
    assert user.email == "hong@example.com"


@pytest.mark.django_db
def test_patch_me_ignores_readonly_fields(auth_client, user):
    original_joined = user.date_joined
    resp = auth_client.patch(
        ME_URL,
        {"username": "hacker", "date_joined": "2000-01-01T00:00:00Z", "first_name": "Changed"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["username"] == "alice"
    user.refresh_from_db()
    assert user.username == "alice"
    assert user.date_joined == original_joined
    assert user.first_name == "Changed"


@pytest.mark.django_db
def test_patch_me_rejects_invalid_email(auth_client, user):
    resp = auth_client.patch(ME_URL, {"email": "not-an-email"}, format="json")
    assert resp.status_code == 400
    assert "email" in resp.data
    user.refresh_from_db()
    assert user.email == "alice@example.com"


@pytest.mark.django_db
def test_logout_ends_session(auth_client):
    assert auth_client.get(ME_URL).status_code == 200
    resp = auth_client.post(LOGOUT_URL)
    assert resp.status_code == 204
    assert auth_client.get(ME_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_no_pending_migrations():
    # 변경 사항이 있으면 makemigrations --check 가 SystemExit 을 발생시킵니다.
    call_command("makemigrations", "--check", "--dry-run")
