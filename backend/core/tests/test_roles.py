# 실행법: cd backend && pytest --ds=config.settings core/tests/test_roles.py
# 권한(관리자·옵저버·사용자)과 사용자 행동 이력 테스트.
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Comment, Post, UserActivity
from core.roles import ROLE_OBSERVER, apply_role
from reporting.models import ChangeLog, IssueComment, Region, RegionalIssue

PASSWORD = "StrongExample!93427"
OPS = "/api/operations/"
ADMIN = "/api/db-admin/"


def make_user(username, role="user", name=""):
    user = get_user_model().objects.create_user(username=username, password=PASSWORD, first_name=name or username.split("@")[0], is_staff=role == "admin")
    if role == ROLE_OBSERVER:
        apply_role(user, ROLE_OBSERVER)
    return user


def login(user):
    client = APIClient()
    assert client.login(username=user.username, password=PASSWORD)
    return client


@pytest.fixture
def region(db):
    return Region.objects.create(region_name="서울")


@pytest.fixture
def people(db):
    return {
        "admin": make_user("admin@example.com", "admin"),
        "alice": make_user("alice@example.com"),
        "bob": make_user("bob@example.com"),
        "olive": make_user("olive@example.com", ROLE_OBSERVER),
    }


def issue_body(region, **values):
    return {"region": region.pk, "title": "디스크 경보", "description": "사용률 91%", "severity": "major", "status": "open", "progress_percent": 10, **values}


@pytest.mark.django_db
def test_role_is_exposed_on_me(people):
    assert login(people["admin"]).get("/api/me/").data["role"] == "admin"
    assert login(people["alice"]).get("/api/me/").data["role"] == "user"
    assert login(people["olive"]).get("/api/me/").data["role"] == "observer"


@pytest.mark.django_db
def test_observer_is_read_only(people, region):
    olive = login(people["olive"])
    assert olive.get(OPS + "current/").status_code == 200
    assert olive.post(OPS + "issues/", issue_body(region), format="json").status_code == 403
    issue = RegionalIssue.objects.create(region=region, title="관리자 등록")
    assert olive.post(OPS + f"issues/{issue.pk}/comments/", {"content": "의견"}, format="json").status_code == 403
    assert olive.post("/api/board/posts/", {"title": "t", "content": "c"}, format="json").status_code == 403
    assert not RegionalIssue.objects.exclude(pk=issue.pk).exists() and not IssueComment.objects.exists()


@pytest.mark.django_db
def test_user_manages_only_own_issue_and_comments(people, region):
    alice, bob = login(people["alice"]), login(people["bob"])
    created = alice.post(OPS + "issues/", issue_body(region), format="json")
    assert created.status_code == 201, created.data
    pk = created.data["row"]["id"]
    assert created.data["row"]["author_name"] == "alice" and created.data["row"]["can_edit"] is True

    # 다른 사용자는 수정·삭제할 수 없고 화면에도 수정 가능으로 표시되지 않습니다.
    assert bob.patch(OPS + f"issues/{pk}/", {"title": "변경"}, format="json").status_code == 403
    assert bob.delete(OPS + f"issues/{pk}/").status_code == 403
    issue_row = next(row for row in bob.get(OPS + "current/").data["issues"] if row["id"] == pk)
    assert issue_row["can_edit"] is False

    # 본인은 일부 항목만 보내서 수정합니다. 이전 값과 새 값이 이력에 남습니다.
    assert alice.patch(OPS + f"issues/{pk}/", {"title": "디스크 경보(정리 중)", "progress_percent": 50}, format="json").status_code == 200
    update = UserActivity.objects.get(user=people["alice"], action="update", target_type="issue")
    assert update.changes["title"] == {"before": "디스크 경보", "after": "디스크 경보(정리 중)"}
    assert update.changes["progress_percent"] == {"before": 10, "after": 50}
    assert "severity" not in update.changes

    # 완료 상태 규칙은 일부 수정에서도 전체 값 기준으로 검사합니다.
    assert alice.patch(OPS + f"issues/{pk}/", {"status": "resolved"}, format="json").status_code == 400

    # 댓글: 다른 사람 댓글은 삭제·수정 불가, 본인 댓글은 가능.
    assert bob.post(OPS + f"issues/{pk}/comments/", {"content": "밥의 의견"}, format="json").status_code == 201
    bob_comment = IssueComment.objects.get(author_username="bob@example.com")
    assert alice.delete(OPS + f"issue-comments/{bob_comment.pk}/").status_code == 403
    assert alice.patch(OPS + f"issue-comments/{bob_comment.pk}/", {"content": "x"}, format="json").status_code == 403
    assert bob.patch(OPS + f"issue-comments/{bob_comment.pk}/", {"content": "밥의 수정 의견"}, format="json").status_code == 200
    assert bob.delete(OPS + f"issue-comments/{bob_comment.pk}/").status_code == 200
    deleted = UserActivity.objects.get(user=people["bob"], action="delete", target_type="issue_comment")
    assert deleted.before_data["content"] == "밥의 수정 의견"

    # 본인 이슈 삭제: 원본 전체(댓글 포함)가 이력에 남습니다.
    alice.post(OPS + f"issues/{pk}/comments/", {"content": "앨리스 메모"}, format="json")
    assert alice.delete(OPS + f"issues/{pk}/").status_code == 200
    removed = UserActivity.objects.get(user=people["alice"], action="delete", target_type="issue")
    assert removed.before_data["title"] == "디스크 경보(정리 중)" and removed.before_data["region_name"] == "서울"
    assert [c["content"] for c in removed.before_data["comments"]] == ["앨리스 메모"]
    assert not RegionalIssue.objects.filter(pk=pk).exists()
    assert ChangeLog.objects.filter(section="issues", action="delete").exists()


@pytest.mark.django_db
def test_admin_edits_and_deletes_anyone(people, region):
    alice, admin = login(people["alice"]), login(people["admin"])
    pk = alice.post(OPS + "issues/", issue_body(region), format="json").data["row"]["id"]
    alice.post(OPS + f"issues/{pk}/comments/", {"content": "앨리스 댓글"}, format="json")
    comment = IssueComment.objects.get()
    assert admin.patch(OPS + f"issue-comments/{comment.pk}/", {"content": "관리자 수정"}, format="json").status_code == 200
    assert admin.patch(OPS + f"issues/{pk}/", {"severity": "critical"}, format="json").status_code == 200
    assert admin.delete(OPS + f"issues/{pk}/").status_code == 200
    # 관리자가 DB 관리에서 등록한(작성자 없는) 이슈는 관리자만 수정합니다.
    legacy = RegionalIssue.objects.create(region=region, title="DB 관리 등록")
    assert alice.patch(OPS + f"issues/{legacy.pk}/", {"title": "x"}, format="json").status_code == 403
    assert admin.patch(OPS + f"issues/{legacy.pk}/", {"title": "관리자 변경"}, format="json").status_code == 200


@pytest.mark.django_db
def test_board_admin_can_modify_and_author_can_delete(people):
    alice, bob, admin = login(people["alice"]), login(people["bob"]), login(people["admin"])
    post_id = alice.post("/api/board/posts/", {"title": "공지", "content": "원문"}, format="json").data["id"]
    comment_id = bob.post(f"/api/board/posts/{post_id}/comments/", {"content": "밥 댓글"}, format="json").data["id"]
    assert bob.delete(f"/api/board/posts/{post_id}/").status_code == 403
    assert alice.delete(f"/api/board/comments/{comment_id}/").status_code == 403
    assert admin.patch(f"/api/board/posts/{post_id}/", {"content": "관리자 수정"}, format="json").status_code == 200
    assert admin.patch(f"/api/board/comments/{comment_id}/", {"content": "관리자 댓글 수정"}, format="json").status_code == 200
    assert bob.delete(f"/api/board/comments/{comment_id}/").status_code == 204
    assert alice.delete(f"/api/board/posts/{post_id}/").status_code == 204
    removed = UserActivity.objects.get(user=people["alice"], action="delete", target_type="post")
    assert removed.before_data["content"] == "관리자 수정"
    assert not Post.objects.exists() and not Comment.objects.exists()


@pytest.mark.django_db
def test_admin_sees_sessions_activity_and_changes_roles(people, region):
    alice = login(people["alice"])
    alice.post(OPS + "issues/", issue_body(region), format="json")
    admin = login(people["admin"])
    accounts = {row["username"]: row for row in admin.get(ADMIN + "accounts/").data}
    assert accounts["alice@example.com"]["is_online"] is True and accounts["alice@example.com"]["role"] == "user"
    assert accounts["bob@example.com"]["is_online"] is False
    assert accounts["olive@example.com"]["role"] == "observer"

    history = admin.get(ADMIN + f"accounts/{people['alice'].pk}/activities/").data
    assert [row["action"] for row in history["activities"]] == ["create", "login"]

    # 권한 변경: 사용자 -> 옵저버 -> 관리자 -> 사용자
    pk = people["alice"].pk
    assert admin.patch(ADMIN + f"accounts/{pk}/", {"role": "observer"}, format="json").data["role"] == "observer"
    assert alice.post(OPS + "issues/", issue_body(region), format="json").status_code == 403
    assert admin.patch(ADMIN + f"accounts/{pk}/", {"role": "admin"}, format="json").data["role"] == "admin"
    assert admin.patch(ADMIN + f"accounts/{pk}/", {"role": "user"}, format="json").data["role"] == "user"
    assert alice.post(OPS + "issues/", issue_body(region), format="json").status_code == 201

    # 로그아웃하면 세션이 끝나고 이력에 남습니다.
    alice.post("/api/auth/logout/")
    accounts = {row["username"]: row for row in admin.get(ADMIN + "accounts/").data}
    assert accounts["alice@example.com"]["is_online"] is False
    assert UserActivity.objects.filter(user=people["alice"], action="logout").exists()

    # 현재 관리자는 자신의 관리자 권한을 해제할 수 없습니다.
    assert admin.patch(ADMIN + f"accounts/{people['admin'].pk}/", {"role": "observer"}, format="json").status_code == 400


@pytest.mark.django_db
def test_non_admin_cannot_read_activity(people):
    assert login(people["alice"]).get(ADMIN + f"accounts/{people['alice'].pk}/activities/").status_code == 403
    assert login(people["olive"]).get(ADMIN + "accounts/").status_code == 403
