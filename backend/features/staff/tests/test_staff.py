import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment
from reporting.models import DataState, StaffMember

ROOT = "/api/operations/staff/"


@pytest.fixture
def admin(db):
    user = get_user_model().objects.create_user(username="Admin", first_name="Admin", email="admin@example.com", is_staff=True)
    client = APIClient(); client.force_authenticate(user); return client


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


@pytest.mark.django_db
def test_staff_creation_defaults_to_responsibility_and_fixed_country(admin):
    response = admin.post(ROOT, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "운영자", "country_code": "KR"}}, format="json")
    assert response.status_code == 201, response.data
    row = response.data["person"]
    assert row["country_code"] == "KR" and row["job_title"] == "책임"
    assert not {"company_name", "work_location", "grade"} & row.keys()


@pytest.mark.django_db
def test_removed_fixed_columns_are_absent_from_database(admin):
    with connection.cursor() as cursor:
        columns = {column.name for column in connection.introspection.get_table_description(cursor, "ops_staff_assignments")}
    assert {"country_code", "custom_values", "job_title"} <= columns
    assert not {"company_name", "work_location", "grade", "region_code"} & columns


@pytest.mark.django_db
@pytest.mark.parametrize("country", ["KR", "EU", "NA"])
def test_each_fixed_country_can_be_selected(admin, country):
    response = admin.post(ROOT, {"revision": revision(), "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": f"{country} 운영자", "country_code": country}}, format="json")
    assert response.status_code == 201 and response.data["person"]["country_code"] == country


@pytest.mark.django_db
@pytest.mark.parametrize("country", ["CN", "", None])
def test_invalid_or_null_country_is_rejected(admin, country):
    before = revision()
    response = admin.post(ROOT, {"revision": before, "person": {"hire_date": "2025-01-01", "deployment_date": "2025-02-01", "staff_name": "운영자", "country_code": country}}, format="json")
    assert response.status_code == 400
    assert not StaffAssignment.objects.exists() and revision() == before


@pytest.mark.django_db
def test_country_database_constraint_rejects_invalid_value():
    member = StaffMember.objects.create(staff_name="운영자")
    with pytest.raises(IntegrityError), transaction.atomic():
        StaffAssignment.objects.create(country_code="CN", staff=member)
