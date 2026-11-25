import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment, StaffChoice, StaffColumn
from reporting.models import ChangeLog, DataState, StaffMember

ROOT = "/api/operations/staff/"


def api(admin=True, name="Admin"):
    user = get_user_model().objects.create_user(username=name, first_name=name, email=f"{name.lower()}@example.com", is_staff=admin)
    client = APIClient(); client.force_authenticate(user); return client, user


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


def add_column(client, label, scoped=False):
    response = client.post(ROOT + "columns/", {"revision": revision(), "label": label, "is_region_scoped": scoped}, format="json")
    assert response.status_code == 201, response.data
    return response.data["column"]


def add_choice(client, key, value, country=""):
    return client.post(ROOT + "choices/", {"revision": revision(), "choice": {"kind": key, "value": value, "country_code": country}}, format="json")


@pytest.mark.django_db
def test_initial_catalog_is_empty_and_fixed_labels_can_be_added():
    client, _ = api()
    assert [item["label"] for item in client.get(ROOT + "options/").data["items"]] == ["입사일", "퇴사일", "업무 투입일", "업무 종료일"]
    company = add_column(client, "소속사")
    location = add_column(client, "근무지", True)
    grade = add_column(client, "등급")
    items = client.get(ROOT + "options/").data["items"]
    items = [item for item in items if item["custom"]]
    assert [(item["label"], item["position"]) for item in items] == [
        ("소속사", 1), ("근무지", 2), ("등급", 3),
    ]
    assert {company["key"], location["key"], grade["key"]} == {item["key"] for item in items}


@pytest.mark.django_db
def test_column_order_can_be_changed_only_with_complete_unique_keys():
    client, _ = api()
    columns = [add_column(client, label) for label in ("소속사", "근무지", "등급")]
    keys = [column["key"] for column in columns]
    assert client.put(ROOT + "columns/", {"revision": revision(), "keys": [keys[2], keys[0], keys[1]]}, format="json").status_code == 200
    assert list(StaffColumn.objects.values_list("key", flat=True)) == [keys[2], keys[0], keys[1]]
    before = revision()
    assert client.put(ROOT + "columns/", {"revision": before, "keys": keys[:2]}, format="json").status_code == 400
    assert revision() == before


@pytest.mark.django_db
def test_staff_custom_values_only_accept_registered_choices_and_region_scope():
    client, _ = api()
    company = add_column(client, "소속사")
    location = add_column(client, "근무지", True)
    add_choice(client, company["key"], "솔로몬텍")
    add_choice(client, location["key"], "상암", "KR")
    payload = {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "새 인력", "country_code": "KR", "custom_values": {company["key"]: "솔로몬텍", location["key"]: "상암"}}}
    response = client.post(ROOT, payload, format="json")
    assert response.status_code == 201, response.data
    assert response.data["person"]["job_title"] == "책임"
    row = StaffAssignment.objects.get()
    assert row.custom_values == {company["key"]: "솔로몬텍", location["key"]: "상암"}
    invalid = client.patch(ROOT, {"revision": revision(), "person": {"id": row.pk, "custom_values": {company["key"]: "미등록"}}}, format="json")
    assert invalid.status_code == 400
    wrong_region = client.patch(ROOT, {"revision": revision(), "person": {"id": row.pk, "country_code": "EU", "custom_values": {location["key"]: "상암"}}}, format="json")
    assert wrong_region.status_code == 200


@pytest.mark.django_db
def test_column_delete_requires_no_choices_or_staff_values_and_reorders():
    client, _ = api()
    first = add_column(client, "첫 열")
    second = add_column(client, "둘째 열")
    add_choice(client, first["key"], "값")
    assert client.delete(ROOT + f"columns/{first['key']}/", {"revision": revision()}, format="json").status_code == 400
    choice = StaffChoice.objects.get(kind=first["key"])
    client.delete(ROOT + f"choices/{choice.pk}/", {"revision": revision()}, format="json")
    person = StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name="인력"), country_code="KR", custom_values={first["key"]: "기존"})
    assert client.delete(ROOT + f"columns/{first['key']}/", {"revision": revision()}, format="json").status_code == 400
    person.custom_values = {}; person.save(update_fields=["custom_values"])
    assert client.delete(ROOT + f"columns/{first['key']}/", {"revision": revision()}, format="json").status_code == 200
    assert list(StaffColumn.objects.values_list("key", "position")) == [(second["key"], 1)]


@pytest.mark.django_db
def test_column_delete_is_logged_and_restorable():
    client, _ = api()
    column = add_column(client, "복구 열")
    assert client.delete(ROOT + f"columns/{column['key']}/", {"revision": revision()}, format="json").status_code == 200
    log = ChangeLog.objects.first()
    preview = client.post(f"/api/db-admin/logs/{log.pk}/restore-preview/", {}, format="json")
    restored = client.post(f"/api/db-admin/logs/{log.pk}/restore/", {"token": preview.data["token"], "confirmed": True}, format="json")
    assert restored.status_code == 200, restored.data
    assert StaffColumn.objects.get(key=column["key"]).label == "복구 열"


@pytest.mark.django_db
def test_user_cannot_manage_items_but_can_update_linked_own_dynamic_value():
    admin, _ = api(True, "Admin")
    item = add_column(admin, "담당 시스템")
    add_choice(admin, item["key"], "A")
    user_client, user = api(False, "Member")
    person = StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name="Member"), account=user, country_code="KR")
    assert user_client.post(ROOT + "columns/", {"revision": revision(), "label": "차단"}, format="json").status_code == 403
    response = user_client.patch(ROOT, {"revision": revision(), "person": {"id": person.pk, "custom_values": {item["key"]: "A"}}}, format="json")
    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_fixed_and_custom_column_order_survives_catalog_changes():
    client, _ = api()
    first = add_column(client, "열 A")["key"]
    second = add_column(client, "열 B")["key"]
    dates = ["hire_date", "resignation_date", "deployment_date", "assignment_end_date"]
    order = [*dates, second, "country_code", first, "staff_name"]
    response = client.put(ROOT + "columns/", {"revision": revision(), "keys": order}, format="json")
    assert response.status_code == 200
    assert response.data["column_order"] == order
    third = add_column(client, "열 C")["key"]
    assert client.get(ROOT + "options/").data["column_order"] == [*order, third]
    deleted = client.delete(ROOT + f"columns/{second}/", {"revision": revision()}, format="json")
    assert deleted.data["column_order"] == [*dates, "country_code", first, "staff_name", third]


@pytest.mark.django_db
def test_free_text_column_accepts_both_suggestions_and_typed_values():
    admin, _ = api()
    created = admin.post(ROOT + "columns/", {"revision": revision(), "label": "좌석", "allow_free_text": True}, format="json")
    key = created.data["column"]["key"]
    person = admin.post(ROOT, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "인력", "country_code": "KR", "custom_values": {key: "A열"}}}, format="json")
    assert person.status_code == 201
    pk = person.data["person"]["id"]
    assert add_choice(admin, key, "B열").status_code in (200, 201)
    for value in ("B열", "C열"):
        response = admin.patch(ROOT, {"revision": revision(), "person": {"id": pk, "custom_values": {key: value}}}, format="json")
        assert response.status_code == 200 and response.data["person"]["custom_values"][key] == value
    url = ROOT + f"columns/{key}/"
    user, _ = api(False, "Member")
    assert user.patch(url, {"revision": revision(), "allow_free_text": False}, format="json").status_code == 403
    assert admin.patch(url, {"revision": revision(), "allow_free_text": False}, format="json").status_code == 200
    assert admin.patch(ROOT, {"revision": revision(), "person": {"id": pk, "custom_values": {key: "D열"}}}, format="json").status_code == 400
    assert StaffAssignment.objects.get(pk=pk).custom_values[key] == "C열"
