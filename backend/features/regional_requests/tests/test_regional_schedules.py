import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_request_schedule_uses_source_and_assigned_regions():
    client = APIClient()
    client.force_login(get_user_model().objects.create_user(username="schedule@example.com"))
    url = "/api/operations/regional_requests/"
    payload = {
        "region": "EU", "assignee_regions": ["KR", "NA"], "requester": "운영팀",
        "title": "점검", "content_html": "<p>점검</p>",
        "schedule_start_local": "2026-11-30T20:00", "schedule_end_local": "2026-11-30T21:00",
    }
    created = client.post(url, payload, format="json")
    assert created.status_code == 201, created.data
    row = created.data["row"]
    listing = client.get(url, {"month": row["month"]}).data
    assert listing[0]["assignee_schedules"] == [
        {"region": "KR", "start": "2026-12-01T04:00+09:00", "end": "2026-12-01T05:00+09:00", "start_zone": "KST", "end_zone": "KST"},
        {"region": "NA", "start": "2026-11-30T11:00-08:00", "end": "2026-11-30T12:00-08:00", "start_zone": "PST", "end_zone": "PST"},
    ]
    detail = f"{url}{row['id']}/"
    updated = client.patch(detail, {"assignee_regions": []}, format="json").data["row"]
    assert updated["schedule_start"] == row["schedule_start"]
    assert updated["assignee_schedules"][0]["start"] == "2026-11-30T20:00+01:00"
    assert updated["assignee_schedules"][0]["start_zone"] == "CET"

    gap = {"region": "NA", "schedule_start_local": "2026-03-08T02:30", "schedule_end_local": "2026-03-08T04:00"}
    response = client.patch(detail, gap, format="json")
    assert response.status_code == 400 and "schedule_start_local" in response.data
    assert client.get(detail).data == updated
