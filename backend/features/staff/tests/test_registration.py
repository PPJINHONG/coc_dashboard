from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment
from invites.models import Invite, hash_token
from reporting.models import StaffMember

TOKEN = "staff-registration-token"


@pytest.fixture
def invite(db):
    admin = get_user_model().objects.create_user(username="Admin", first_name="Admin", email="admin@example.com", is_staff=True)
    return Invite.objects.create(created_by=admin, token_hash=hash_token(TOKEN), token_hint=TOKEN[-4:], expires_at=timezone.now() + timedelta(days=1), max_uses=10)


@pytest.mark.django_db
def test_signup_creates_account_only_until_admin_links_staff(invite):
    response = APIClient().post("/api/auth/register/", {"name": "신규 책임", "email": "new@example.com", "password": "1234", "invite": TOKEN}, format="json")
    assert response.status_code == 201, response.data
    user = get_user_model().objects.get(username="신규 책임")
    assert user.email == "new@example.com" and not user.is_staff
    assert not StaffAssignment.objects.filter(account=user).exists()
    assert not StaffMember.objects.filter(staff_name="신규 책임").exists()


@pytest.mark.django_db
def test_signup_rejects_removed_country_and_staff_payload_without_side_effect(invite):
    response = APIClient().post("/api/auth/register/", {
        "name": "신규 책임", "email": "new@example.com", "password": "1234", "invite": TOKEN,
        "country_code": "KR", "staff": {"work_location": "상암"},
    }, format="json")
    # 알 수 없는 과거 필드는 무시하더라도 운영 인력은 자동 생성하지 않습니다.
    assert response.status_code == 201, response.data
    assert not StaffAssignment.objects.exists() and not StaffMember.objects.exists()
