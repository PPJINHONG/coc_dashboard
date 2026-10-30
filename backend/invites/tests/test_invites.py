# 실행법: pytest --ds=config.settings invites/tests
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from invites.models import Invite, InviteUse, hash_token

REGISTER_URL = "/api/auth/register/"
INVITES_URL = "/api/invites/"
PASSWORD = "Updated!93827"


def check_url(token):
    return f"/api/auth/invites/{token}/"


def _signup(token, username="new@example.com", **extra):
    data = {"name": "새 팀원", "username": username, "password": PASSWORD, **extra}
    if token is not None:
        data["invite"] = token
    return APIClient().post(REGISTER_URL, data, format="json")


@pytest.fixture
def member(db):
    return get_user_model().objects.create_user(
        username="member@example.com", email="member@example.com", password=PASSWORD, first_name="멤버"
    )


@pytest.fixture
def member_client(member):
    client = APIClient()
    client.force_authenticate(member)
    return client


def _issue(client, **data):
    response = client.post(INVITES_URL, data, format="json")
    assert response.status_code == 201, response.data
    return response.data


@pytest.mark.django_db
def test_signup_without_invite_is_rejected():
    response = _signup(None)
    assert response.status_code == 400
    assert "초대 링크" in response.data["invite"][0]
    assert not get_user_model().objects.exists()


@pytest.mark.django_db
def test_signup_with_unknown_invite_is_rejected():
    response = _signup("not-a-real-token")
    assert response.status_code == 400
    assert "invite" in response.data
    assert not get_user_model().objects.exists()


def test_regular_member_can_issue_invite_without_admin(member_client, member):
    data = _issue(member_client)
    assert data["status"] == "active"
    assert data["max_uses"] == 10
    assert data["created_by_name"] == "멤버"
    assert len(data["token"]) >= 30
    saved = Invite.objects.get()
    # 원문 토큰은 DB에 저장하지 않습니다.
    assert saved.token_hash == hash_token(data["token"])
    assert data["token"] not in saved.token_hash
    days = (saved.expires_at - timezone.now()).total_seconds() / 86400
    assert 0.9 < days <= 1


def test_list_never_exposes_token(member_client):
    _issue(member_client)
    listed = member_client.get(INVITES_URL).data
    assert len(listed) == 1
    assert "token" not in listed[0]


@pytest.mark.django_db
def test_anonymous_cannot_issue_invite():
    assert APIClient().post(INVITES_URL, {}, format="json").status_code == 403
    assert not Invite.objects.exists()


def test_invite_signup_logs_in_and_records_use(member_client):
    token = _issue(member_client)["token"]
    check = APIClient().get(check_url(token))
    assert check.status_code == 200
    assert check.data["inviter_name"] == "멤버"

    client = APIClient()
    response = client.post(
        REGISTER_URL,
        {"name": "새 팀원", "username": "New@Example.com", "password": PASSWORD, "invite": token},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert client.get("/api/me/").data["username"] == "new@example.com"
    invite = Invite.objects.get()
    assert invite.use_count == 1
    use = InviteUse.objects.get()
    assert use.user.username == "new@example.com"
    assert member_client.get(INVITES_URL).data[0]["joined"] == ["새 팀원"]


def test_single_use_invite_stops_after_first_signup(member_client):
    token = _issue(member_client)["token"]
    Invite.objects.update(max_uses=1)
    assert _signup(token, "first@example.com").status_code == 201
    second = _signup(token, "second@example.com")
    assert second.status_code == 400
    assert "인원이 다 찬" in second.data["invite"][0]
    assert APIClient().get(check_url(token)).status_code == 404
    assert not get_user_model().objects.filter(username="second@example.com").exists()


def test_expired_invite_is_rejected(member_client):
    token = _issue(member_client)["token"]
    Invite.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    response = _signup(token)
    assert response.status_code == 400
    assert "기간이 지난" in response.data["invite"][0]
    check = APIClient().get(check_url(token))
    assert check.status_code == 404 and check.data["status"] == "expired"


def test_creator_can_revoke_and_link_stops_working(member_client):
    data = _issue(member_client)
    revoked = member_client.post(f"{INVITES_URL}{data['id']}/revoke/", format="json")
    assert revoked.status_code == 200 and revoked.data["status"] == "revoked"
    response = _signup(data["token"])
    assert response.status_code == 400
    assert "취소된" in response.data["invite"][0]


def test_other_member_cannot_see_or_revoke(member_client):
    data = _issue(member_client)
    other = get_user_model().objects.create_user(username="other@example.com", password=PASSWORD)
    client = APIClient()
    client.force_authenticate(other)
    assert client.get(INVITES_URL).data == []
    assert client.post(f"{INVITES_URL}{data['id']}/revoke/", format="json").status_code == 404
    assert Invite.objects.get().revoked_at is None


def test_staff_sees_and_revokes_all_invites(member_client):
    data = _issue(member_client)
    admin = get_user_model().objects.create_user(username="boss@example.com", password=PASSWORD, is_staff=True)
    client = APIClient()
    client.force_authenticate(admin)
    assert [item["id"] for item in client.get(INVITES_URL).data] == [data["id"]]
    assert client.post(f"{INVITES_URL}{data['id']}/revoke/", format="json").status_code == 200


def test_failed_signup_does_not_consume_invite(member_client):
    token = _issue(member_client)["token"]
    Invite.objects.update(max_uses=1)
    response = _signup(token, username="not-an-email")
    assert response.status_code == 400
    assert Invite.objects.get().use_count == 0
    assert _signup(token).status_code == 201


@pytest.fixture
def staff_client(db):
    admin = get_user_model().objects.create_user(username="boss@example.com", password=PASSWORD, is_staff=True)
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.mark.parametrize(
    "payload",
    [{"expires_days": 7}, {"expires_days": 30}, {"max_uses": 20}, {"max_uses": 50}, {"max_uses": None}, {"max_uses": -1}],
)
def test_member_is_limited_to_one_day_and_ten(member_client, payload):
    response = member_client.post(INVITES_URL, payload, format="json")
    assert response.status_code == 400
    assert not Invite.objects.exists()


def test_member_options(member_client):
    assert member_client.get(f"{INVITES_URL}options/").data == {
        "expires_days": [1],
        "max_uses": [10],
        "default_expires_days": 1,
        "default_max_uses": 10,
    }


def test_staff_options_and_default(staff_client):
    assert staff_client.get(f"{INVITES_URL}options/").data == {
        "expires_days": [1, 7, 30],
        "max_uses": [50, 100, 200],
        "default_expires_days": 7,
        "default_max_uses": 50,
    }
    data = _issue(staff_client)
    assert data["max_uses"] == 50
    days = (Invite.objects.get().expires_at - timezone.now()).total_seconds() / 86400
    assert 6.9 < days <= 7


@pytest.mark.parametrize("expires_days", [1, 7, 30])
@pytest.mark.parametrize("max_uses", [50, 100, 200])
def test_staff_can_issue_large_invites(staff_client, expires_days, max_uses):
    data = _issue(staff_client, expires_days=expires_days, max_uses=max_uses)
    assert data["max_uses"] == max_uses


@pytest.mark.parametrize("payload", [{"max_uses": 10}, {"max_uses": 201}, {"max_uses": None}, {"expires_days": 3}])
def test_staff_options_are_limited(staff_client, payload):
    response = staff_client.post(INVITES_URL, payload, format="json")
    assert response.status_code == 400
    assert not Invite.objects.exists()


@pytest.mark.django_db
def test_anonymous_cannot_read_options():
    assert APIClient().get(f"{INVITES_URL}options/").status_code == 403


def test_staff_invite_admits_many_signups(staff_client):
    token = _issue(staff_client, max_uses=50)["token"]
    Invite.objects.update(use_count=48)
    assert _signup(token, "a@example.com").status_code == 201
    assert _signup(token, "b@example.com").status_code == 201
    assert _signup(token, "c@example.com").status_code == 400
    assert Invite.objects.get().use_count == 50
