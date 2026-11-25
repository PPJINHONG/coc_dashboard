import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment, StaffChoice, StaffColumn
from reporting.models import ChangeLog, DataState, StaffMember

ROOT = "/api/operations/staff/"


def client(admin=False):
    user = get_user_model().objects.create_user(username="Admin" if admin else "Member", first_name="Admin" if admin else "Member", email="a@example.com" if admin else "m@example.com", is_staff=admin)
    api = APIClient(); api.force_authenticate(user); return api


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


def column(api, label="소속사", scoped=False):
    response = api.post(ROOT + "columns/", {"revision": revision(), "label": label, "is_region_scoped": scoped}, format="json")
    assert response.status_code == 201, response.data
    return response.data["column"]


@pytest.mark.django_db
def test_only_admin_manages_columns_and_values():
    member = client()
    assert member.post(ROOT + "columns/", {"revision": 0, "label": "소속사"}, format="json").status_code == 403
    admin = client(True)
    created = column(admin)
    assert member.post(ROOT + "choices/", {"revision": revision(), "choice": {"kind": created["key"], "value": "회사"}}, format="json").status_code == 403
    assert admin.post(ROOT + "choices/", {"revision": revision(), "choice": {"kind": created["key"], "value": "회사"}}, format="json").status_code == 200


@pytest.mark.django_db
def test_choices_are_shared_across_regions():
    admin = client(True)
    created = column(admin, "근무지", True)
    payload = {"revision": revision(), "choice": {"kind": created["key"], "value": "상암"}}
    assert admin.post(ROOT + "choices/", payload, format="json").status_code == 200
    payload["revision"] = revision()
    payload["choice"]["country_code"] = "KR"
    assert admin.post(ROOT + "choices/", payload, format="json").status_code == 400



@pytest.mark.django_db
def test_deleting_value_preserves_existing_staff_value():
    admin = client(True)
    created = column(admin, "등급")
    response = admin.post(ROOT + "choices/", {"revision": revision(), "choice": {"kind": created["key"], "value": "L1"}}, format="json")
    choice = StaffChoice.objects.get()
    person = StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name="인력"), country_code="KR", custom_values={created["key"]: "L1"})
    assert response.status_code == 200
    assert admin.delete(ROOT + f"choices/{choice.pk}/", {"revision": revision()}, format="json").status_code == 200
    person.refresh_from_db(); assert person.custom_values[created["key"]] == "L1"
    item = admin.get(ROOT + "options/").data["items"][0]
    assert item["values"] == [{"value": "L1", "choice_id": None, "uses": 1}]


@pytest.mark.django_db
def test_choice_delete_is_audited_and_restorable():
    admin = client(True)
    created = column(admin)
    admin.post(ROOT + "choices/", {"revision": revision(), "choice": {"kind": created["key"], "value": "회사"}}, format="json")
    choice = StaffChoice.objects.get()
    assert admin.delete(ROOT + f"choices/{choice.pk}/", {"revision": revision()}, format="json").status_code == 200
    log = ChangeLog.objects.first()
    preview = admin.post(f"/api/db-admin/logs/{log.pk}/restore-preview/", {}, format="json")
    restored = admin.post(f"/api/db-admin/logs/{log.pk}/restore/", {"token": preview.data["token"], "confirmed": True}, format="json")
    assert restored.status_code == 200, restored.data
    assert StaffChoice.objects.get(pk=choice.pk).value == "회사"
