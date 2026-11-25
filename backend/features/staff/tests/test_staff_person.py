import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment
from reporting.models import ChangeLog, DataState, StaffMember

URL = "/api/operations/staff/"


def client(admin=False, name="Member"):
    user = get_user_model().objects.create_user(username=name, first_name=name, email=f"{name.lower()}@example.com", is_staff=admin)
    api = APIClient(); api.force_authenticate(user); return api, user


def person(name, country="KR", account=None):
    return StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name=name), country_code=country, account=account)


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


@pytest.mark.django_db
def test_admin_creates_and_updates_one_person_without_touching_others():
    kept = person("기존 인력")
    admin, _ = client(True, "Admin")
    created = admin.post(URL, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "신규 인력", "country_code": "EU"}}, format="json")
    assert created.status_code == 201, created.data
    updated = admin.patch(URL, {"revision": created.data["revision"], "person": {"id": created.data["person"]["id"], "staff_name": "수정 인력", "country_code": "NA"}}, format="json")
    assert updated.status_code == 200, updated.data
    kept.refresh_from_db(); assert kept.staff.staff_name == "기존 인력"
    assert StaffAssignment.objects.count() == 2 and ChangeLog.objects.filter(section="staff").count() == 2


@pytest.mark.django_db
def test_user_cannot_add_or_edit_others_but_can_edit_linked_self():
    api, user = client(False, "책임 사용자")
    own = person("책임 사용자", account=user)
    other = person("다른 인력")
    assert api.post(URL, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "신규", "country_code": "KR"}}, format="json").status_code == 403
    assert api.patch(URL, {"revision": revision(), "person": {"id": other.pk, "staff_name": "변경"}}, format="json").status_code == 403
    response = api.patch(URL, {"revision": revision(), "person": {"id": own.pk, "staff_name": "본인 변경", "job_description": "운영"}}, format="json")
    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_country_is_required_and_post_patch_cannot_be_confused():
    admin, _ = client(True, "Admin")
    existing = person("기존")
    assert admin.post(URL, {"revision": revision(), "person": {"id": existing.pk, "staff_name": "오류", "country_code": "KR"}}, format="json").status_code == 400
    assert admin.patch(URL, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "오류", "country_code": "KR"}}, format="json").status_code == 400
    assert admin.post(URL, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "권역 없음"}}, format="json").status_code == 400
