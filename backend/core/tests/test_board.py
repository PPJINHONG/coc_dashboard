# 실행법: cd backend && pytest --ds=config.settings core/tests
# 게시판 슬라이스 테스트. MEDIA_ROOT 는 tmp_path 로 override 합니다.
import io

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None

PASSWORD = "pass12345!"

POSTS_URL = "/api/board/posts/"
IMAGES_URL = "/api/board/images/"


def _post_detail_url(pk):
    return f"/api/board/posts/{pk}/"


def _comments_url(pk):
    return f"/api/board/posts/{pk}/comments/"


def _comment_detail_url(pk):
    return f"/api/board/comments/{pk}/"


def _image_serve_url(pk):
    return f"/api/board/images/{pk}/"


@pytest.fixture(autouse=True)
def _media_root(settings, tmp_path):
    # 업로드 파일이 실제 저장소를 건드리지 않도록 tmp_path 로 격리합니다.
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.fixture
def alice(db):
    return get_user_model().objects.create_user(username="alice", password=PASSWORD)


@pytest.fixture
def bob(db):
    return get_user_model().objects.create_user(username="bob", password=PASSWORD)


@pytest.fixture
def alice_client(alice):
    client = APIClient()
    assert client.login(username="alice", password=PASSWORD)
    return client


@pytest.fixture
def bob_client(bob):
    client = APIClient()
    assert client.login(username="bob", password=PASSWORD)
    return client


def _png_bytes(size=(4, 4), color=(255, 0, 0)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    buf.seek(0)
    return buf


def _upload_png(client, name="test.png"):
    img = _png_bytes()
    img.name = name
    resp = client.post(IMAGES_URL, {"file": img}, format="multipart")
    return resp


@pytest.mark.django_db
def test_board_requires_auth():
    client = APIClient()
    assert client.get(POSTS_URL).status_code in (401, 403)
    assert client.post(POSTS_URL, {"title": "t", "content": "c"}, format="json").status_code in (401, 403)
    assert client.get(_post_detail_url(1)).status_code in (401, 403)
    assert client.post(IMAGES_URL, {}, format="multipart").status_code in (401, 403)
    assert client.get(_image_serve_url(1)).status_code in (401, 403)


@pytest.mark.django_db
def test_create_post_and_list_newest_first(alice_client):
    r1 = alice_client.post(POSTS_URL, {"title": "첫 글", "content": "본문1"}, format="json")
    assert r1.status_code == 201
    assert r1.data["title"] == "첫 글"
    assert r1.data["author"] == "alice"
    assert r1.data["is_mine"] is True
    assert r1.data["images"] == []
    assert r1.data["comments"] == []

    r2 = alice_client.post(POSTS_URL, {"title": "둘째 글", "content": "본문2"}, format="json")
    assert r2.status_code == 201

    lst = alice_client.get(POSTS_URL)
    assert lst.status_code == 200
    assert len(lst.data) == 2
    # 최신순: 둘째 글이 먼저
    assert lst.data[0]["title"] == "둘째 글"
    assert lst.data[1]["title"] == "첫 글"
    assert lst.data[0]["comment_count"] == 0
    assert lst.data[0]["image_count"] == 0
    assert lst.data[0]["author"] == "alice"


@pytest.mark.django_db
def test_create_post_rejects_blank(alice_client):
    r = alice_client.post(POSTS_URL, {"title": "   ", "content": "   "}, format="json")
    assert r.status_code == 400
    assert "title" in r.data or "content" in r.data


@pytest.mark.django_db
def test_update_post_author_only(alice_client, bob_client):
    created = alice_client.post(POSTS_URL, {"title": "원제목", "content": "원본문"}, format="json")
    pid = created.data["id"]

    # 타인은 403
    r_other = bob_client.patch(_post_detail_url(pid), {"title": "해킹"}, format="json")
    assert r_other.status_code == 403

    # 작성자는 수정 가능
    r_own = alice_client.patch(_post_detail_url(pid), {"title": "새제목"}, format="json")
    assert r_own.status_code == 200
    assert r_own.data["title"] == "새제목"
    assert r_own.data["content"] == "원본문"


@pytest.mark.django_db
def test_delete_post_author_only_cascades(alice_client, bob_client):
    created = alice_client.post(POSTS_URL, {"title": "삭제대상", "content": "본문"}, format="json")
    pid = created.data["id"]
    # 댓글 하나 달기
    alice_client.post(_comments_url(pid), {"content": "댓글"}, format="json")

    # 타인 삭제 403
    assert bob_client.delete(_post_detail_url(pid)).status_code == 403

    # 작성자 삭제 204
    assert alice_client.delete(_post_detail_url(pid)).status_code == 204
    # 글 사라짐 404, 댓글도 cascade 삭제
    assert alice_client.get(_post_detail_url(pid)).status_code == 404

    from core.models import Comment, Post

    assert not Post.objects.filter(id=pid).exists()
    assert not Comment.objects.filter(post_id=pid).exists()


@pytest.mark.django_db
def test_comment_create_and_detail(alice_client):
    created = alice_client.post(POSTS_URL, {"title": "글", "content": "본문"}, format="json")
    pid = created.data["id"]

    c = alice_client.post(_comments_url(pid), {"content": "첫 댓글"}, format="json")
    assert c.status_code == 201
    assert c.data["content"] == "첫 댓글"
    assert c.data["author"] == "alice"
    assert c.data["is_mine"] is True

    # 빈 댓글 400
    bad = alice_client.post(_comments_url(pid), {"content": "   "}, format="json")
    assert bad.status_code == 400

    detail = alice_client.get(_post_detail_url(pid))
    assert detail.status_code == 200
    assert len(detail.data["comments"]) == 1
    assert detail.data["comments"][0]["content"] == "첫 댓글"


@pytest.mark.django_db
def test_comment_update_delete_author_only(alice_client, bob_client):
    created = alice_client.post(POSTS_URL, {"title": "글", "content": "본문"}, format="json")
    pid = created.data["id"]
    c = alice_client.post(_comments_url(pid), {"content": "원댓글"}, format="json")
    cid = c.data["id"]

    # 타인 수정/삭제 403
    assert bob_client.patch(_comment_detail_url(cid), {"content": "x"}, format="json").status_code == 403
    assert bob_client.delete(_comment_detail_url(cid)).status_code == 403

    # 작성자 수정
    r = alice_client.patch(_comment_detail_url(cid), {"content": "수정됨"}, format="json")
    assert r.status_code == 200
    assert r.data["content"] == "수정됨"

    # 작성자 삭제 204
    assert alice_client.delete(_comment_detail_url(cid)).status_code == 204
    from core.models import Comment

    assert not Comment.objects.filter(id=cid).exists()


@pytest.mark.django_db
def test_image_upload_validation(alice_client):
    # png 201
    ok = _upload_png(alice_client)
    assert ok.status_code == 201
    assert "id" in ok.data
    assert ok.data["url"] == _image_serve_url(ok.data["id"])

    # 텍스트 파일 400
    txt = io.BytesIO(b"this is not an image")
    txt.name = "note.txt"
    r_txt = alice_client.post(IMAGES_URL, {"file": txt}, format="multipart")
    assert r_txt.status_code == 400

    # 5MB 초과 400 (유효 png 헤더지만 크기 초과)
    big = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024 + 10))
    big.name = "big.png"
    r_big = alice_client.post(IMAGES_URL, {"file": big}, format="multipart")
    assert r_big.status_code == 400


@pytest.mark.django_db
def test_attach_images_and_serve(alice_client):
    up = _upload_png(alice_client)
    img_id = up.data["id"]

    created = alice_client.post(
        POSTS_URL,
        {"title": "이미지 글", "content": "본문", "image_ids": [img_id]},
        format="json",
    )
    assert created.status_code == 201
    pid = created.data["id"]
    assert len(created.data["images"]) == 1
    assert created.data["images"][0]["id"] == img_id
    assert created.data["images"][0]["url"] == _image_serve_url(img_id)

    # 서빙: 로그인 필요, content_type 정확
    served = alice_client.get(_image_serve_url(img_id))
    assert served.status_code == 200
    assert served["Content-Type"] == "image/png"

    # 목록에 image_count 반영
    lst = alice_client.get(POSTS_URL)
    row = next(r for r in lst.data if r["id"] == pid)
    assert row["image_count"] == 1

    # PATCH 로 첨부 비우면 이미지 삭제
    patched = alice_client.patch(_post_detail_url(pid), {"image_ids": []}, format="json")
    assert patched.status_code == 200
    assert patched.data["images"] == []
    from core.models import PostImage

    assert not PostImage.objects.filter(id=img_id).exists()


@pytest.mark.django_db
def test_attach_others_image_rejected(alice_client, bob_client):
    # bob 이 올린 이미지를 alice 가 첨부 시도 -> 400 {image_ids: [...]}
    up = _upload_png(bob_client)
    others_id = up.data["id"]

    r = alice_client.post(
        POSTS_URL,
        {"title": "도용 시도", "content": "본문", "image_ids": [others_id]},
        format="json",
    )
    assert r.status_code == 400
    assert "image_ids" in r.data
    assert others_id in r.data["image_ids"]
