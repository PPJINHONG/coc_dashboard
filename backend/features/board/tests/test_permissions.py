# 게시판 권한: 관리자는 모두 수정, 작성자는 본인 글·댓글만 삭제, 옵저버는 쓰기 불가.
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import UserActivity
from core.roles import ROLE_OBSERVER, apply_role
from features.board.models import Comment, Post

PASSWORD = "StrongExample!93427"


def make_user(username, role="user"):
    user = get_user_model().objects.create_user(username=username, password=PASSWORD, first_name=username.split("@")[0], is_staff=role == "admin")
    if role == ROLE_OBSERVER:
        apply_role(user, ROLE_OBSERVER)
    return user


def login(user):
    client = APIClient()
    assert client.login(username=user.username, password=PASSWORD)
    return client


@pytest.fixture
def people(db):
    return {
        "admin": make_user("admin@example.com", "admin"),
        "alice": make_user("alice@example.com"),
        "bob": make_user("bob@example.com"),
        "olive": make_user("olive@example.com", ROLE_OBSERVER),
    }


@pytest.mark.django_db
def test_observer_cannot_write_posts(people):
    assert login(people["olive"]).post("/api/board/posts/", {"title": "t", "content": "c"}, format="json").status_code == 403
    assert not Post.objects.exists()


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
