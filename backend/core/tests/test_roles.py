# 권한(관리자·옵저버·사용자)과 사용자 행동 이력 테스트. 기능별 쓰기 권한은 각 기능 앱 tests에 있습니다.
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import UserActivity
from core.roles import ROLE_OBSERVER, apply_role
from reporting.models import Region

PASSWORD = "StrongExample!93427"
OPS = "/api/operations/"
ADMIN = "/api/db-admin/"


def make_user(username, role="user", name=""):
    user = get_user_model().objects.create_user(username=username, password=PASSWORD, first_name=name or username.split("@")[0], is_staff=role == "admin")
    if role == ROLE_OBSERVER:
        apply_role(user, ROLE_OBSERVER)
    return user


def login(user):
    client = APIClient()
    assert client.login(username=user.username, password=PASSWORD)
    return client


@pytest.fixture
def region(db):
    return Region.objects.create(region_name="서울")


@pytest.fixture
def people(db):
    return {
        "admin": make_user("admin@example.com", "admin"),
        "alice": make_user("alice@example.com"),
        "bob": make_user("bob@example.com"),
        "olive": make_user("olive@example.com", ROLE_OBSERVER),
    }


def issue_body(region, **values):
    return {"region": region.pk, "title": "디스크 경보", "description": "사용률 91%", "severity": "major", "status": "open", "progress_percent": 10, **values}


@pytest.mark.django_db
def test_role_is_exposed_on_me(people):
    assert login(people["admin"]).get("/api/me/").data["role"] == "admin"
    assert login(people["alice"]).get("/api/me/").data["role"] == "user"
    assert login(people["olive"]).get("/api/me/").data["role"] == "observer"


@pytest.mark.django_db
def test_admin_sees_sessions_activity_and_changes_roles(people, region):
    alice = login(people["alice"])
    alice.post(OPS + "issues/", issue_body(region), format="json")
    admin = login(people["admin"])
    accounts = {row["username"]: row for row in admin.get(ADMIN + "accounts/").data}
    assert accounts["alice@example.com"]["is_online"] is True and accounts["alice@example.com"]["role"] == "user"
    assert accounts["bob@example.com"]["is_online"] is False
    assert accounts["olive@example.com"]["role"] == "observer"

    history = admin.get(ADMIN + f"accounts/{people['alice'].pk}/activities/").data
    assert [row["action"] for row in history["activities"]] == ["create", "login"]

    # 권한 변경: 사용자 -> 옵저버 -> 관리자 -> 사용자
    pk = people["alice"].pk
    assert admin.patch(ADMIN + f"accounts/{pk}/", {"role": "observer"}, format="json").data["role"] == "observer"
    assert alice.post(OPS + "issues/", issue_body(region), format="json").status_code == 403
    assert admin.patch(ADMIN + f"accounts/{pk}/", {"role": "admin"}, format="json").data["role"] == "admin"
    assert admin.patch(ADMIN + f"accounts/{pk}/", {"role": "user"}, format="json").data["role"] == "user"
    assert alice.post(OPS + "issues/", issue_body(region), format="json").status_code == 201

    # 로그아웃하면 세션이 끝나고 이력에 남습니다.
    alice.post("/api/auth/logout/")
    accounts = {row["username"]: row for row in admin.get(ADMIN + "accounts/").data}
    assert accounts["alice@example.com"]["is_online"] is False
    assert UserActivity.objects.filter(user=people["alice"], action="logout").exists()

    # 현재 관리자는 자신의 관리자 권한을 해제할 수 없습니다.
    assert admin.patch(ADMIN + f"accounts/{people['admin'].pk}/", {"role": "observer"}, format="json").status_code == 400


@pytest.mark.django_db
def test_non_admin_cannot_read_activity(people):
    assert login(people["alice"]).get(ADMIN + f"accounts/{people['alice'].pk}/activities/").status_code == 403
    assert login(people["olive"]).get(ADMIN + "accounts/").status_code == 403
