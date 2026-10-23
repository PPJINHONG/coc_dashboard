import logging

from django.contrib.auth import authenticate, login, logout
from django.db import DatabaseError, connection
from django.db.models import Count
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Comment, Post, PostImage
from .serializers import (
    CommentSerializer,
    CommentWriteSerializer,
    ErrorSerializer,
    LoginSerializer,
    MeSerializer,
    PostDetailSerializer,
    PostImageSerializer,
    PostListSerializer,
    PostWriteSerializer,
    TestListSerializer,
)

logger = logging.getLogger(__name__)

LOGIN_FAIL_DETAIL = "아이디 또는 비밀번호가 올바르지 않습니다."


def home(request):
    return render(request, "core/home.html")


class TestListView(APIView):
    @extend_schema(
        summary="test 테이블 조회",
        description="test 테이블의 id와 message를 id 순서로 반환합니다.",
        responses={200: TestListSerializer, 503: ErrorSerializer},
    )
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id, message FROM public.test ORDER BY id")
                rows = [{"id": row[0], "message": row[1]} for row in cursor.fetchall()]
        except DatabaseError:
            logger.exception("Failed to read test table")
            return Response({"error": "데이터를 조회할 수 없습니다."}, status=503)
        return Response(TestListSerializer({"results": rows}).data)


# === 슬라이스1: 세션 로그인 + 회원 정보 ===


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """csrftoken 쿠키를 발급합니다. 프론트가 비-GET 요청 전에 호출합니다."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response({"detail": LOGIN_FAIL_DETAIL}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)
        return Response(MeSerializer(user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


# === 게시판 슬라이스 ===

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


class PostListCreateView(APIView):
    permission_classes = [IsAuthenticated]

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

        detail = PostDetailSerializer(post, context={"request": request}).data
        return Response(detail, status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_post(self, pk):
        return get_object_or_404(Post.objects.select_related("author"), pk=pk)

    def get(self, request, pk):
        post = self._get_post(pk)
        data = PostDetailSerializer(post, context={"request": request}).data
        return Response(data)

    def patch(self, request, pk):
        post = self._get_post(pk)
        if post.author_id != request.user.id:
            return Response(
                {"detail": "작성자만 수정할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = PostWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        # image_ids 가 들어오면 첨부 전체 교체(빠진 이미지는 삭제).
        if "image_ids" in validated:
            try:
                images = _resolve_image_ids(request.user, validated["image_ids"], post=post)
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

        data = PostDetailSerializer(post, context={"request": request}).data
        return Response(data)

    def delete(self, request, pk):
        post = self._get_post(pk)
        if post.author_id != request.user.id:
            return Response(
                {"detail": "작성자만 삭제할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = Comment.objects.create(
            post=post,
            author=request.user,
            content=serializer.validated_data["content"],
        )
        data = CommentSerializer(comment, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_comment(self, pk):
        return get_object_or_404(Comment.objects.select_related("author"), pk=pk)

    def patch(self, request, pk):
        comment = self._get_comment(pk)
        if comment.author_id != request.user.id:
            return Response(
                {"detail": "작성자만 수정할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment.content = serializer.validated_data["content"]
        comment.save()
        data = CommentSerializer(comment, context={"request": request}).data
        return Response(data)

    def delete(self, request, pk):
        comment = self._get_comment(pk)
        if comment.author_id != request.user.id:
            return Response(
                {"detail": "작성자만 삭제할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN
            )
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
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
