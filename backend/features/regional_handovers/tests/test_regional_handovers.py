from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from core.models import UserActivity
from core.roles import apply_role
from features.regional_handovers.models import RegionalHandover, RegionalHandoverImage
from reporting.models import ChangeLog


URL = "/api/operations/regional_handovers/"


@pytest.fixture
def handover_setup(db, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    users = {}
    for role in ("admin", "user", "other", "observer"):
        user = get_user_model().objects.create_user(
            username=f"{role}@handover.test",
            first_name=role,
            is_staff=role == "admin",
        )
        if role == "observer":
            apply_role(user, "observer")
        users[role] = user
    return users


def client(user):
    value = APIClient()
    value.force_login(user)
    return value


def revision(api):
    response = api.get(URL)
    assert response.status_code == 200
    return response.data["revision"]


def values(**updates):
    return {
        "region": "KR",
        "priority": "high",
        "status": "in_progress",
        "category": "issue",
        "title": "결제 시스템 확인",
        "content_html": '<p data-bad="x"><strong>승인 지연</strong>을 확인하세요.</p>',
        **updates,
    }


def upload(api):
    stream = BytesIO()
    Image.new("RGB", (3, 2), "blue").save(stream, format="PNG")
    content = stream.getvalue()
    response = api.post(
        f"{URL}images/",
        {"file": SimpleUploadedFile("handover.png", content, content_type="image/png")},
        format="multipart",
    )
    assert response.status_code == 201, response.data
    return response.data, content


@pytest.mark.django_db
def test_author_crud_permissions_and_sanitized_rich_content(handover_setup):
    users = handover_setup
    author = client(users["user"])
    created = author.post(URL, {"revision": revision(author), **values(category="notice")}, format="json")
    assert created.status_code == 201, created.data
    row = created.data["row"]
    assert row["priority_label"] == "중요" and row["status_label"] == "진행 중"
    assert row["can_edit"] is True and row["can_delete"] is False
    assert "data-bad" not in row["content_html"] and "<strong>" in row["content_html"]

    other = client(users["other"])
    listed = other.get(URL).data
    assert listed["rows"][0]["can_edit"] is False
    path = f"{URL}{row['id']}/"
    assert other.patch(path, {"revision": listed["revision"], "title": "가로채기"}, format="json").status_code == 403

    updated = author.patch(
        path,
        {"revision": created.data["revision"], "status": "completed", "title": "진행 상황 확인"},
        format="json",
    )
    assert updated.status_code == 200, updated.data
    assert updated.data["row"]["status_label"] == "완료"
    assert author.delete(path, {"revision": updated.data["revision"]}, format="json").status_code == 403

    admin = client(users["admin"])
    deleted = admin.delete(path, {"revision": updated.data["revision"]}, format="json")
    assert deleted.status_code == 200, deleted.data
    assert not RegionalHandover.objects.exists()
    assert ChangeLog.objects.filter(section="regional_handovers").count() == 3
    assert UserActivity.objects.filter(target_type="regional_handover").count() == 3
    feed = admin.get("/api/operations/logs/", {"section": "regional_handovers"}).data["results"]
    assert [row["action"] for row in feed] == ["delete", "update", "create"]
    assert feed[2]["actor_name"] == "user" and feed[2]["changes"][0]["after"]["category"] == "notice"
    assert feed[1]["changes"][0]["before"]["title"] == "결제 시스템 확인"
    assert feed[1]["changes"][0]["after"]["title"] == "진행 상황 확인"



@pytest.mark.django_db
def test_legacy_observer_group_is_regular_user_and_input_is_validated(handover_setup):
    users = handover_setup
    writer = client(users["user"])
    current = revision(writer)
    invalid = writer.post(URL, {"revision": current, **values(title=" ", region="CN")}, format="json")
    assert invalid.status_code == 400 and not RegionalHandover.objects.exists()
    assert writer.post(URL, {"revision": current, **values(priority="critical")}, format="json").status_code == 400
    assert writer.post(URL, {"revision": current, **values(category="task")}, format="json").status_code == 400
    assert writer.post(URL, {"revision": current, **values(status="open")}, format="json").status_code == 400

    created = writer.post(URL, {"revision": current, **values()}, format="json")
    assert created.status_code == 201
    stale = writer.patch(
        f"{URL}{created.data['row']['id']}/",
        {"revision": current, "title": "오래 열린 화면의 수정"},
        format="json",
    )
    assert stale.status_code == 409
    assert RegionalHandover.objects.get().title == "결제 시스템 확인"

    observer = client(users["observer"])
    listing = observer.get(URL)
    assert listing.status_code == 200 and len(listing.data["rows"]) == 1
    assert listing.data["rows"][0]["can_edit"] is False
    assert observer.post(URL, {"revision": listing.data["revision"], **values()}, format="json").status_code == 201
    assert observer.post(f"{URL}images/", {}, format="multipart").status_code == 400


@pytest.mark.django_db
def test_uploaded_images_require_ownership_and_attached_images_are_visible(handover_setup):
    users = handover_setup
    author = client(users["user"])
    image, content = upload(author)
    other = client(users["other"])
    rejected = other.post(
        URL,
        {"revision": revision(other), **values(content_html=f'<p>도용</p><img src="{image["url"]}">')},
        format="json",
    )
    assert rejected.status_code == 400

    created = author.post(
        URL,
        {"revision": revision(author), **values(content_html=f'<p>화면 확인</p><img src="{image["url"]}">')},
        format="json",
    )
    assert created.status_code == 201, created.data
    stored = RegionalHandoverImage.objects.get(pk=image["id"])
    assert stored.handover_id == created.data["row"]["id"]
    response = other.get(image["url"])
    assert response.status_code == 200 and response["Content-Type"] == "image/png"
    assert b"".join(response.streaming_content) == content

    external = author.patch(
        f"{URL}{created.data['row']['id']}/",
        {"revision": created.data["revision"], "content_html": '<p>외부</p><img src="https://example.com/a.png">'},
        format="json",
    )
    assert external.status_code == 400
    assert RegionalHandoverImage.objects.filter(pk=image["id"]).exists()


@pytest.mark.django_db
def test_delete_history_restores_handover_and_image(handover_setup, django_capture_on_commit_callbacks):
    users = handover_setup
    author = client(users["user"])
    image, content = upload(author)
    created = author.post(
        URL,
        {"revision": revision(author), **values(content_html=f'<p>복구할 내용</p><img src="{image["url"]}">')},
        format="json",
    )
    assert created.status_code == 201, created.data
    handover_id = created.data["row"]["id"]
    stored = RegionalHandoverImage.objects.get(pk=image["id"])
    storage, name = stored.file.storage, stored.file.name

    admin = client(users["admin"])
    with django_capture_on_commit_callbacks(execute=True):
        deleted = admin.delete(f"{URL}{handover_id}/", {"revision": created.data["revision"]}, format="json")
        assert deleted.status_code == 200, deleted.data
    assert not RegionalHandover.objects.exists() and not RegionalHandoverImage.objects.exists()
    assert not storage.exists(name)

    log = ChangeLog.objects.get(section="regional_handovers", action="delete")
    preview = admin.post(f"/api/db-admin/logs/{log.pk}/restore-preview/", {}, format="json")
    assert preview.status_code == 200, preview.data
    restored = admin.post(
        f"/api/db-admin/logs/{log.pk}/restore/",
        {"token": preview.data["token"], "confirmed": True},
        format="json",
    )
    assert restored.status_code == 200, restored.data
    handover = RegionalHandover.objects.get(pk=handover_id)
    restored_image = RegionalHandoverImage.objects.get(pk=image["id"])
    assert handover.region == "KR" and "복구할 내용" in handover.content_html
    assert restored_image.handover_id == handover_id
    with restored_image.file.open("rb") as source:
        assert source.read() == content

    snapshot = admin.get("/api/operations/current/").data
    assert snapshot["totals"]["regional_handovers"] == 1
    assert snapshot["totals"]["regional_handovers_active"] == 1
