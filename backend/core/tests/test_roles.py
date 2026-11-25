import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.roles import apply_role, assignable_roles, can_manage_members, staff_edit_countries, user_role


@pytest.fixture
def users(db):
    admin = get_user_model().objects.create_user(username="관리자", first_name="관리자", email="admin@example.com", is_staff=True)
    member = get_user_model().objects.create_user(username="책임", first_name="책임", email="member@example.com")
    return admin, member


@pytest.mark.django_db
def test_only_admin_and_user_roles_are_exposed(users):
    admin, member = users
    assert user_role(admin) == "admin" and user_role(member) == "user"
    assert assignable_roles(admin) == [("admin", "관리자"), ("user", "책임")]
    assert assignable_roles(member) == []
    assert can_manage_members(admin) and not can_manage_members(member)
    assert staff_edit_countries(admin) == ["KR", "EU", "NA"]
    assert staff_edit_countries(member) == []


@pytest.mark.django_db
def test_legacy_groups_do_not_grant_permissions(users):
    _, member = users
    for legacy in ("team_lead", "group_lead_KR", "observer"):
        from django.contrib.auth.models import Group
        member.groups.add(Group.objects.create(name=legacy))
    assert user_role(member) == "user"
    assert not can_manage_members(member) and staff_edit_countries(member) == []
    apply_role(member, "user")
    assert not member.groups.filter(name__in=["team_lead", "group_lead_KR", "observer"]).exists()


@pytest.mark.django_db
def test_user_cannot_access_management_apis(users):
    admin, member = users
    client = APIClient(); client.force_authenticate(member)
    assert client.get("/api/members/").status_code == 403
    assert client.get("/api/operations/logs/").status_code == 403
    assert client.get("/api/db-admin/").status_code == 403
    assert client.get("/api/invites/").status_code == 403
    admin_client = APIClient(); admin_client.force_authenticate(admin)
    assert admin_client.get("/api/members/").status_code == 200
    assert admin_client.get("/api/operations/logs/").status_code == 200
