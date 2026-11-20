import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.regional_notices.models import RegionalNotice
from reporting.models import Region


@pytest.fixture
def admin_client(db):
    admin = get_user_model().objects.create_user(
        username="notice-admin@example.com",
        first_name="공지 관리자",
        is_staff=True,
    )
    client = APIClient()
    client.force_login(admin)
    return client


@pytest.fixture
def region(db):
    return Region.objects.create(region_name="KR 테스트", country_code="KR")


def notice_values(region):
    return {
        "region": region.pk,
        "scheduled_at": "2026-11-13T14:00:00+09:00",
        "title": "네트워크 장비 점검",
        "content": "이중화 상태를 확인하고 장비를 순차 점검합니다.",
        "category": "정기점검",
    }


@pytest.mark.django_db
def test_admin_creates_updates_and_deletes_notice_in_feature_api(admin_client, region):
    created = admin_client.post(
        "/api/operations/regional_notices/",
        {"revision": 0, **notice_values(region)},
        format="json",
    )
    assert created.status_code == 201, created.data
    assert created.data["row"]["author"] == "공지 관리자"
    assert created.data["row"]["country_code"] == "KR"
    notice_id = created.data["row"]["id"]

    listed = admin_client.get("/api/operations/regional_notices/?month=2026-11")
    assert listed.status_code == 200
    assert [row["id"] for row in listed.data] == [notice_id]

    updated = admin_client.patch(
        f"/api/operations/regional_notices/{notice_id}/",
        {"revision": created.data["revision"], "title": "수정된 작업공지"},
        format="json",
    )
    assert updated.status_code == 200, updated.data
    assert updated.data["row"]["title"] == "수정된 작업공지"

    deleted = admin_client.delete(
        f"/api/operations/regional_notices/{notice_id}/",
        {"revision": updated.data["revision"]},
        format="json",
    )
    assert deleted.status_code == 200
    assert RegionalNotice.objects.count() == 0


@pytest.mark.django_db
def test_notice_write_is_admin_only_and_db_section_is_removed(admin_client, region):
    user = get_user_model().objects.create_user(username="notice-user@example.com")
    client = APIClient()
    client.force_login(user)
    assert client.get("/api/operations/regional_notices/?month=2026-11").status_code == 200
    assert client.post(
        "/api/operations/regional_notices/",
        {"revision": 0, **notice_values(region)},
        format="json",
    ).status_code == 403
    assert admin_client.put(
        "/api/db-admin/sections/regional_notices/",
        {"revision": 0, "month": "2026-11", "rows": []},
        format="json",
    ).status_code == 400


@pytest.mark.django_db
def test_notice_requires_requested_fields(admin_client, region):
    values = notice_values(region)
    values["title"] = ""
    response = admin_client.post(
        "/api/operations/regional_notices/",
        {"revision": 0, **values},
        format="json",
    )
    assert response.status_code == 400
    assert RegionalNotice.objects.count() == 0


@pytest.mark.parametrize(("country", "local", "expected"), [
    ("EU", "2026-11-30T20:00", "2026-12-01T04:00:00+09:00"),
    ("EU", "2026-07-31T20:00", "2026-08-01T03:00:00+09:00"),
    ("NA", "2026-07-31T20:00", "2026-08-01T12:00:00+09:00"),
    ("KR", "2026-11-01T00:00", "2026-11-01T00:00:00+09:00"),
])
def test_country_notice_without_master_region_uses_kst_month(admin_client, country, local, expected):
    url = "/api/operations/regional_notices/"
    payload = {"country_code": country, "scheduled_local": local, "title": "점검", "content": "작업", "category": "점검"}
    response = admin_client.post(url, {"revision": 0, **payload}, format="json")
    assert response.status_code == 201, response.data
    row = response.data["row"]
    assert row["country_code"] == country
    assert row["scheduled_at"] == expected
    assert row["month"] == expected[:7]
    assert not Region.objects.exists()
    assert admin_client.get(url, {"month": row["month"], "country": country}).data == [row]
