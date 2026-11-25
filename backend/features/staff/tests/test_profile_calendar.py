from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment, StaffCalendarEvent, StaffColumn, StaffChoice, StaffHeadcountRecord, StaffResponsibility
from reporting.models import DataState, StaffMember

ROOT = "/api/operations/staff/"


def account(name, admin=False):
    return get_user_model().objects.create_user(username=name, first_name=name, email=f"{name.lower()}@example.com", is_staff=admin)


def client(user):
    api = APIClient(); api.force_authenticate(user); return api


def person(name, country="KR", user=None, **values):
    return StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name=name), country_code=country, account=user, **values)


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


@pytest.mark.django_db
def test_admin_options_include_accounts_and_user_options_do_not():
    admin = account("Admin", True); member = account("Member")
    person("Member", user=member)
    assert len(client(admin).get(ROOT + "options/").data["accounts"]) == 2
    options = client(member).get(ROOT + "options/").data
    assert options["accounts"] == [] and options["my_assignment"] is not None


@pytest.mark.django_db
def test_linked_user_can_manage_only_own_calendar():
    user = account("Member")
    own = person("Member", user=user, deployment_date=date(2026, 1, 1))
    other = person("Other")
    api = client(user)
    created = api.post(ROOT + "calendar/", {"revision": revision(), "event": {"kind": "leave", "title": "연차", "start_date": "2026-11-10", "end_date": "2026-11-11"}}, format="json")
    assert created.status_code == 201, created.data
    event_id = created.data["event"]["id"]
    assert created.data["event"]["assignment"] == own.pk
    assert api.patch(ROOT + f"calendar/{event_id}/", {"revision": revision(), "event": {"title": "수정"}}, format="json").status_code == 200
    foreign = StaffCalendarEvent.objects.create(assignment=other, country_code="KR", kind="leave", start_date="2026-12-01", end_date="2026-12-01")
    assert api.delete(ROOT + f"calendar/{foreign.pk}/", {"revision": revision()}, format="json").status_code == 403
    assert api.delete(ROOT + f"calendar/{event_id}/", {"revision": revision()}, format="json").status_code == 200


@pytest.mark.django_db
def test_calendar_rejects_unlinked_overlap_and_invalid_dates():
    user = account("Member"); api = client(user)
    assert api.post(ROOT + "calendar/", {"revision": revision(), "event": {"kind": "leave", "start_date": "2026-11-10", "end_date": "2026-11-11"}}, format="json").status_code == 403
    person("Member", user=user, deployment_date=date(2026, 11, 1), resignation_date=date(2026, 11, 30))
    payload = {"revision": revision(), "event": {"kind": "leave", "start_date": "2026-11-10", "end_date": "2026-11-11"}}
    assert api.post(ROOT + "calendar/", payload, format="json").status_code == 201
    assert api.post(ROOT + "calendar/", {**payload, "revision": revision()}, format="json").status_code == 400
    assert api.post(ROOT + "calendar/", {"revision": revision(), "event": {"kind": "leave", "start_date": "2026-12-01", "end_date": "2026-12-02"}}, format="json").status_code == 400


@pytest.mark.django_db
def test_admin_sets_region_responsibilities_and_hours():
    admin = account("Admin", True); api = client(admin)
    kr = person("KR 책임", "KR"); eu = person("EU 책임", "EU")
    response = api.put(ROOT + "responsibilities/", {"revision": revision(), "responsibility": {"country_code": "KR", "team_lead": kr.pk, "group_lead": kr.pk, "work_start": "08:00", "work_end": "17:00"}}, format="json")
    assert response.status_code == 200, response.data
    saved = StaffResponsibility.objects.get(country_code="KR")
    assert saved.team_lead_id == kr.pk and saved.work_start.isoformat() == "08:00:00"
    invalid = api.put(ROOT + "responsibilities/", {"revision": revision(), "responsibility": {"country_code": "KR", "group_lead": eu.pk}}, format="json")
    assert invalid.status_code == 400
    member = account("Plain")
    assert client(member).put(ROOT + "responsibilities/", {"revision": revision(), "responsibility": {"country_code": "KR"}}, format="json").status_code == 403


@pytest.mark.django_db
def test_trend_company_filter_uses_dynamic_company_column():
    admin = account("Admin", True); api = client(admin)
    column = StaffColumn.objects.create(label="소속사", position=1)
    StaffChoice.objects.create(column=column, kind=column.key, value="솔로몬텍")
    person("A", deployment_date=date(2026, 1, 1), custom_values={column.key: "솔로몬텍"})
    person("B", deployment_date=date(2026, 1, 1), custom_values={column.key: "다른 회사"})
    result = api.get(ROOT + "trend/", {"month": "2026-11", "company": "솔로몬텍"})
    assert result.status_code == 200
    assert result.data["companies"] == ["다른 회사", "솔로몬텍"]
    assert result.data["months"][-1]["headcount"] == 1


@pytest.mark.django_db
def test_account_and_staff_names_stay_synchronized_for_name_login():
    admin = account("Admin", True); user = account("Before")
    row = person("Before", user=user)
    response = client(admin).patch(ROOT, {"revision": revision(), "person": {"id": row.pk, "staff_name": "After"}}, format="json")
    assert response.status_code == 200, response.data
    user.refresh_from_db(); assert user.first_name == user.username == "After"


@pytest.mark.django_db
def test_trend_counts_the_four_dates_and_uses_legacy_records_for_headcount():
    api = client(account("Admin", True))
    person("업무 종료", hire_date=date(2024, 1, 5), deployment_date=date(2024, 1, 20),
           assignment_end_date=date(2024, 2, 10), resignation_date=date(2024, 3, 1))
    person("배치 없는 입사자", hire_date=date(2024, 2, 3))
    person("유럽 인력", country="EU", hire_date=date(2024, 2, 3), deployment_date=date(2024, 2, 6))
    StaffHeadcountRecord.objects.create(period_month=date(2024, 1, 1), country_code="KR",
                                        headcount=8, entries=7, exits=6)
    response = api.get(ROOT + "trend/", {"month": "2024-03", "country": "KR"})
    assert response.status_code == 200
    jan, feb, mar = response.data["months"][-3:]
    assert (jan["hires"], jan["deployments"], jan["headcount"], jan["recorded"]) == (1, 1, 8, True)
    assert (feb["hires"], feb["assignment_ends"], feb["resignations"], feb["headcount"]) == (1, 1, 0, 0)
    assert (mar["resignations"], mar["assignment_ends"], mar["headcount"]) == (1, 0, 0)
