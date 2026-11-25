from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment
from invites.models import Invite, InviteUse, hash_token

REGISTER_URL = "/api/auth/register/"
INVITES_URL = "/api/invites/"


def account(name, *, admin=False):
    return get_user_model().objects.create_user(
        username=name, first_name=name, email=f"{name.lower()}@example.com", password="1234", is_staff=admin,
    )


def client_for(user):
    client = APIClient(); client.force_authenticate(user); return client


@pytest.fixture
def admin_client(db):
    return client_for(account("Admin", admin=True))


def issue(client, **values):
    response = client.post(INVITES_URL, values, format="json")
    assert response.status_code == 201, response.data
    return response.data


def signup(token, name="새 책임", email="new@example.com"):
    return APIClient().post(REGISTER_URL, {"name": name, "email": email, "password": "1234", "invite": token}, format="json")


@pytest.mark.django_db
def test_only_admin_can_list_create_options_and_revoke(admin_client):
    member = account("Member")
    client = client_for(member)
    assert client.get(INVITES_URL).status_code == 403
    assert client.post(INVITES_URL, {}, format="json").status_code == 403
    assert client.get(f"{INVITES_URL}options/").status_code == 403
    created = issue(admin_client)
    assert created["status"] == "active" and created["max_uses"] == 50
    assert admin_client.post(f"{INVITES_URL}{created['id']}/revoke/", {}, format="json").status_code == 200


@pytest.mark.django_db
def test_invite_token_is_returned_once_and_hashed(admin_client):
    created = issue(admin_client)
    saved = Invite.objects.get()
    assert saved.token_hash == hash_token(created["token"])
    assert created["token"] not in saved.token_hash
    listed = admin_client.get(INVITES_URL).data
    assert "token" not in listed[0]


@pytest.mark.django_db
def test_invite_signup_creates_account_only_with_name_login(admin_client):
    token = issue(admin_client)["token"]
    response = signup(token)
    assert response.status_code == 201, response.data
    assert response.data["username"] == response.data["name"] == "새 책임"
    assert response.data["email"] == "new@example.com" and response.data["role"] == "user"
    assert Invite.objects.get().use_count == 1
    assert InviteUse.objects.get().user.username == "새 책임"
    assert not StaffAssignment.objects.exists()


@pytest.mark.django_db
def test_missing_unknown_expired_revoked_and_used_invites_are_rejected(admin_client):
    assert signup(None).status_code == 400
    assert signup("unknown").status_code == 400
    token = issue(admin_client)["token"]
    Invite.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert signup(token).status_code == 400
    Invite.objects.update(expires_at=timezone.now() + timedelta(days=1), revoked_at=timezone.now())
    assert signup(token).status_code == 400
    Invite.objects.update(revoked_at=None, max_uses=1, use_count=1)
    assert signup(token).status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize("expires_days", [1, 7, 30])
@pytest.mark.parametrize("max_uses", [50, 100, 200])
def test_admin_invite_options(admin_client, expires_days, max_uses):
    created = issue(admin_client, expires_days=expires_days, max_uses=max_uses)
    assert created["max_uses"] == max_uses


@pytest.mark.django_db
def test_invalid_signup_does_not_consume_invite(admin_client):
    token = issue(admin_client, max_uses=50)["token"]
    response = signup(token, name="", email="bad")
    assert response.status_code == 400 and Invite.objects.get().use_count == 0
