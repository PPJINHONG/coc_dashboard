import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import UserActivity
from core.roles import user_role
from core.security import must_change_password

URL = "/api/members/"


def person(name, *, admin=False):
    return get_user_model().objects.create_user(
        username=name,
        first_name=name,
        email=f"{name.lower()}@example.com",
        password="1234",
        is_staff=admin,
    )


def client_for(user):
    client = APIClient(); client.force_login(user); return client


@pytest.mark.django_db
def test_members_is_admin_only():
    member = person("Member")
    client = client_for(member)
    assert client.get(URL).status_code == 403
    assert client.post(URL, {}, format="json").status_code == 403
    assert APIClient().get(URL).status_code == 403


@pytest.mark.django_db
def test_admin_lists_only_two_roles_and_can_promote_user():
    admin = person("Admin", admin=True)
    target = person("Target")
    client = client_for(admin)
    result = client.get(URL)
    assert result.status_code == 200
    assert result.data["assignable_roles"] == [
        {"value": "admin", "label": "관리자"},
        {"value": "user", "label": "책임"},
    ]
    updated = client.patch(f"{URL}{target.pk}/", {"role": "admin"}, format="json")
    assert updated.status_code == 200 and updated.data["role"] == "admin"
    target.refresh_from_db(); assert target.is_staff and user_role(target) == "admin"
    assert client.patch(f"{URL}{target.pk}/", {"role": "team_lead"}, format="json").status_code == 400


@pytest.mark.django_db
def test_member_creation_uses_name_login_initial_password_and_default_role():
    admin = person("Admin", admin=True)
    client = client_for(admin)
    data = {"name": "신규 책임", "email": "new@example.com"}
    result = client.post(URL, data, format="json")
    assert result.status_code == 201, result.data
    target = get_user_model().objects.get(pk=result.data["id"])
    assert target.username == target.first_name == "신규 책임"
    assert target.email == "new@example.com" and target.check_password("1111")
    assert user_role(target) == "user" and must_change_password(target)
    assert client.post(URL, {"name": "신규 책임", "email": "other@example.com"}, format="json").status_code == 400
    assert "password" not in UserActivity.objects.get(action="create").after_data


@pytest.mark.django_db
def test_admin_updates_name_email_status_and_login_name_together():
    admin = person("Admin", admin=True)
    target = person("Before")
    result = client_for(admin).patch(
        f"{URL}{target.pk}/",
        {"name": "변경 이름", "email": "changed@example.com", "is_active": False},
        format="json",
    )
    assert result.status_code == 200, result.data
    target.refresh_from_db()
    assert target.username == target.first_name == "변경 이름"
    assert target.email == "changed@example.com" and not target.is_active


@pytest.mark.django_db
def test_password_reset_sets_1111_requires_change_and_invalidates_sessions():
    admin = person("Admin", admin=True)
    target = person("ResetTarget")
    target_client = client_for(target)
    assert target_client.get("/api/me/").status_code == 200
    response = client_for(admin).post(f"{URL}{target.pk}/reset-password/", {}, format="json")
    assert response.status_code == 200 and response.data["must_change_password"]
    target.refresh_from_db()
    assert target.check_password("1111") and must_change_password(target)
    assert target_client.get("/api/me/").status_code in (401, 403)
    activity = UserActivity.objects.filter(target_id=str(target.pk), summary__contains="비밀번호 초기화").get()
    assert "1111" not in str(activity.before_data) + str(activity.after_data)


@pytest.mark.django_db
def test_admin_cannot_edit_or_reset_self_or_superuser():
    admin = person("Admin", admin=True)
    client = client_for(admin)
    assert client.patch(f"{URL}{admin.pk}/", {"is_active": False}, format="json").status_code == 400
    assert client.post(f"{URL}{admin.pk}/reset-password/", {}, format="json").status_code == 400
    superuser = get_user_model().objects.create_superuser(username="Root", first_name="Root", email="root@example.com", password="1234")
    assert client.patch(f"{URL}{superuser.pk}/", {"role": "user"}, format="json").status_code == 400
