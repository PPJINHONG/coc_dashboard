"""게시판 글·댓글·첨부 이미지 API (/api/board/...). 화면은 아직 메뉴에 연결하지 않았습니다."""

from django.db.models import Count
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import CanWrite, can_modify, record_activity

from .models import Comment, Post, PostImage
from .serializers import (
    CommentSerializer,
    CommentWriteSerializer,
    PostDetailSerializer,
    PostImageSerializer,
    PostListSerializer,
    PostWriteSerializer,
)


MAX_IMAGES_PER_POST = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "GIF", "WEBP"}
PILLOW_TO_CONTENT_TYPE = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "GIF": "image/gif",
    "WEBP": "image/webp",
}


def _resolve_image_ids(user, image_ids, post=None):
    """요청한 image_ids 가 모두 유효한지 검증하고 PostImage 목록을 돌려줍니다.

    - 본인이 업로드한 이미지여야 하고
    - post 가 null(미첨부)이거나 바로 이 글에 붙은 이미지여야 합니다.
    하나라도 어긋나면 ValueError(잘못된 id 목록)를 던집니다.
    """
    ids = list(dict.fromkeys(image_ids))  # 중복 제거, 순서 유지
    if len(ids) > MAX_IMAGES_PER_POST:
        raise ValueError(ids)
    qs = PostImage.objects.filter(id__in=ids, uploader=user)
    found = {img.id: img for img in qs}
    bad = []
    resolved = []
    for iid in ids:
        img = found.get(iid)
        if img is None:
            bad.append(iid)
            continue
        if img.post_id is not None and not (post is not None and img.post_id == post.id):
            bad.append(iid)
            continue
        resolved.append(img)
    if bad:
        raise ValueError(bad)
    return resolved


def _post_snapshot(post):
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "author": post.author.username,
        "image_ids": sorted(post.images.values_list("id", flat=True)),
        "comments": [
            {"id": c.id, "author": c.author.username, "content": c.content}
            for c in post.comments.select_related("author").all()
        ],
    }


def _comment_snapshot(comment):
    return {"id": comment.id, "post": comment.post_id, "author": comment.author.username, "content": comment.content}


class PostListCreateView(APIView):
    permission_classes = [CanWrite]

    def get(self, request):
        posts = (
            Post.objects.select_related("author")
            .annotate(comment_count=Count("comments", distinct=True), image_count=Count("images", distinct=True))
            .order_by("-created_at")
        )
        data = PostListSerializer(posts, many=True, context={"request": request}).data
        return Response(data)

    def post(self, request):
        serializer = PostWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image_ids = serializer.validated_data.get("image_ids", None)

        if image_ids:
            try:
                images = _resolve_image_ids(request.user, image_ids)
            except ValueError as exc:
                return Response({"image_ids": exc.args[0]}, status=status.HTTP_400_BAD_REQUEST)
        else:
            images = []

        post = Post.objects.create(
            author=request.user,
            title=serializer.validated_data["title"],
            content=serializer.validated_data["content"],
        )
        if images:
            for img in images:
                img.post = post
            PostImage.objects.bulk_update(images, ["post"])

        record_activity(request, "create", f"게시글 #{post.id} 작성: {post.title}", "post", post.id, after=_post_snapshot(post))
        detail = PostDetailSerializer(post, context={"request": request}).data
        return Response(detail, status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    permission_classes = [CanWrite]

    def _get_post(self, pk):
        return get_object_or_404(Post.objects.select_related("author"), pk=pk)

    def get(self, request, pk):
        post = self._get_post(pk)
        data = PostDetailSerializer(post, context={"request": request}).data
        return Response(data)

    def patch(self, request, pk):
        post = self._get_post(pk)
        if not can_modify(request.user, post.author.username):
            return Response(
                {"detail": "작성자 또는 관리자만 수정할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        before = _post_snapshot(post)
        serializer = PostWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        # image_ids 가 들어오면 첨부 전체 교체(빠진 이미지는 삭제). 이미지는 글 작성자가 올린 것만 허용합니다.
        if "image_ids" in validated:
            try:
                images = _resolve_image_ids(post.author, validated["image_ids"], post=post)
            except ValueError as exc:
                return Response({"image_ids": exc.args[0]}, status=status.HTTP_400_BAD_REQUEST)
            keep_ids = {img.id for img in images}
            # 기존 첨부 중 교체 목록에 없는 것은 삭제(파일도 시그널로 제거).
            for existing in post.images.all():
                if existing.id not in keep_ids:
                    existing.delete()
            for img in images:
                if img.post_id != post.id:
                    img.post = post
                    img.save(update_fields=["post"])

        if "title" in validated:
            post.title = validated["title"]
        if "content" in validated:
            post.content = validated["content"]
        post.save()

        record_activity(request, "update", f"게시글 #{post.id} 수정", "post", post.id, before=before, after=_post_snapshot(post))
        data = PostDetailSerializer(post, context={"request": request}).data
        return Response(data)

    def delete(self, request, pk):
        post = self._get_post(pk)
        if not can_modify(request.user, post.author.username):
            return Response(
                {"detail": "작성자 또는 관리자만 삭제할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        before = _post_snapshot(post)
        post.delete()
        record_activity(request, "delete", f"게시글 #{pk} 삭제: {before['title']}", "post", pk, before=before)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentCreateView(APIView):
    permission_classes = [CanWrite]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = Comment.objects.create(
            post=post,
            author=request.user,
            content=serializer.validated_data["content"],
        )
        record_activity(request, "create", f"게시글 #{post.id} 댓글 작성", "post_comment", comment.id, after=_comment_snapshot(comment))
        data = CommentSerializer(comment, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    permission_classes = [CanWrite]

    def _get_comment(self, pk):
        return get_object_or_404(Comment.objects.select_related("author"), pk=pk)

    def patch(self, request, pk):
        comment = self._get_comment(pk)
        if not can_modify(request.user, comment.author.username):
            return Response(
                {"detail": "작성자 또는 관리자만 수정할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        before = _comment_snapshot(comment)
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment.content = serializer.validated_data["content"]
        comment.save()
        record_activity(request, "update", f"게시글 #{comment.post_id} 댓글 수정", "post_comment", comment.id, before=before, after=_comment_snapshot(comment))
        data = CommentSerializer(comment, context={"request": request}).data
        return Response(data)

    def delete(self, request, pk):
        comment = self._get_comment(pk)
        if not can_modify(request.user, comment.author.username):
            return Response(
                {"detail": "작성자 또는 관리자만 삭제할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        before = _comment_snapshot(comment)
        comment.delete()
        record_activity(request, "delete", f"게시글 #{before['post']} 댓글 삭제", "post_comment", pk, before=before)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ImageUploadView(APIView):
    permission_classes = [CanWrite]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"file": ["이미지 파일(file)이 필요합니다."]}, status=status.HTTP_400_BAD_REQUEST
            )
        if upload.size > MAX_IMAGE_BYTES:
            return Response(
                {"file": ["이미지 크기는 5MB를 넘을 수 없습니다."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Pillow 로 실제 이미지인지, 허용 포맷인지 검증합니다.
        from PIL import Image, UnidentifiedImageError

        try:
            upload.seek(0)
            with Image.open(upload) as im:
                im.verify()
            fmt = (im.format or "").upper()
        except (UnidentifiedImageError, OSError, ValueError):
            return Response(
                {"file": ["유효한 이미지 파일이 아닙니다."]}, status=status.HTTP_400_BAD_REQUEST
            )
        finally:
            upload.seek(0)

        if fmt not in ALLOWED_IMAGE_FORMATS:
            return Response(
                {"file": ["png/jpeg/gif/webp 형식만 허용됩니다."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image = PostImage.objects.create(uploader=request.user, file=upload)
        data = PostImageSerializer(image, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class ImageServeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        image = get_object_or_404(PostImage, pk=pk)
        try:
            fh = image.file.open("rb")
        except FileNotFoundError:
            raise Http404("이미지 파일을 찾을 수 없습니다.")

        content_type = None
        from PIL import Image as PILImage

        try:
            image.file.seek(0)
            with PILImage.open(image.file) as im:
                content_type = PILLOW_TO_CONTENT_TYPE.get((im.format or "").upper())
        except Exception:
            content_type = None
        finally:
            image.file.seek(0)

        if content_type is None:
            import mimetypes

            content_type = mimetypes.guess_type(image.file.name)[0] or "application/octet-stream"

        return FileResponse(fh, content_type=content_type)
