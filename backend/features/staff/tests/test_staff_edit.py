import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment, StaffCalendarEvent
from reporting.models import ChangeLog, DataState, StaffMember

URL = "/api/operations/staff/"


def login(admin=False, name="Member"):
    user = get_user_model().objects.create_user(username=name, first_name=name, email=f"{name.lower()}@example.com", is_staff=admin)
    client = APIClient(); client.force_login(user); return client, user


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


def row(name, country, **values):
    return {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": name, "country_code": country, **values}


def assignment(name, country, account=None):
    return StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name=name), country_code=country, account=account)


@pytest.mark.django_db
def test_admin_batch_edits_all_fixed_countries():
    client, _ = login(True, "Admin")
    response = client.put(URL, {"revision": revision(), "rows": [
        row("한국 인력", "KR", pc_ip="10.0.0.1"), row("유럽 인력", "EU"), row("북미 인력", "NA"),
    ]}, format="json")
    assert response.status_code == 200, response.data
    assert StaffAssignment.objects.count() == 3
    assert set(StaffAssignment.objects.values_list("country_code", flat=True)) == {"KR", "EU", "NA"}
    assert all(item["can_edit"] for item in client.get("/api/operations/current/").data["staff"])
    assert ChangeLog.objects.filter(section="staff").exists()


@pytest.mark.django_db
def test_user_cannot_batch_edit_and_only_linked_row_is_editable():
    client, user = login(False, "Member")
    own = assignment("Member", "KR", user)
    assignment("Other", "EU")
    listed = {item["id"]: item["can_edit"] for item in client.get("/api/operations/current/").data["staff"]}
    assert listed[own.pk] and sum(listed.values()) == 1
    assert client.put(URL, {"revision": revision(), "rows": []}, format="json").status_code == 403


@pytest.mark.django_db
def test_calendar_link_prevents_batch_deletion():
    kept = assignment("담당자", "KR")
    StaffCalendarEvent.objects.create(assignment=kept, country_code="KR", kind="leave", start_date="2026-11-01", end_date="2026-11-02")
    assignment("삭제 대상", "KR")
    client, _ = login(True, "Admin")
    before = revision()
    assert client.put(URL, {"revision": before, "rows": []}, format="json").status_code == 400
    assert StaffAssignment.objects.count() == 2 and revision() == before


@pytest.mark.django_db
def test_stale_revision_conflicts():
    client, _ = login(True, "Admin")
    assert client.put(URL, {"revision": revision(), "rows": [row("관리자 입력", "NA")]}, format="json").status_code == 200
    assert client.put(URL, {"revision": 0, "rows": []}, format="json").status_code == 409
