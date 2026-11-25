import mimetypes
from datetime import timedelta

from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import CanWrite, can_write, display_name, is_admin, record_activity
from reporting.history import capture_history
from reporting.services import bump, check_revision, lock_state, record_log

from .models import RegionalHandover, RegionalHandoverImage
from .serializers import RegionalHandoverImageSerializer, RegionalHandoverSerializer


MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_FRAMES = 120
MAX_IMAGES = 10
ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "GIF", "WEBP"}
CONTENT_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "GIF": "image/gif", "WEBP": "image/webp"}


def handover_queryset():
    return RegionalHandover.objects.select_related("author").prefetch_related("images")


def content_image_ids(serializer):
    return serializer.context.get("content_image_ids", [])


def resolve_images(user, ids, handover=None):
    ids = list(dict.fromkeys(ids))
    if len(ids) > MAX_IMAGES:
        raise ValidationError({"content_html": [f"이미지는 {MAX_IMAGES}개까지 넣을 수 있습니다."]})
    found = {image.pk: image for image in RegionalHandoverImage.objects.filter(pk__in=ids)}
    resolved = []
    for image_id in ids:
        image = found.get(image_id)
        if image is None:
            raise ValidationError({"content_html": ["본문 이미지가 존재하지 않습니다."]})
        existing = handover is not None and image.handover_id == handover.pk
        fresh = image.handover_id is None and image.uploader_id == user.pk
        if not existing and not fresh:
            raise ValidationError({"content_html": ["직접 업로드했거나 이 핸드오버에 첨부된 이미지만 사용할 수 있습니다."]})
        resolved.append(image)
    return resolved


def sync_images(handover, images):
    keep_ids = {image.pk for image in images}
    for existing in handover.images.all():
        if existing.pk not in keep_ids:
            existing.delete()
    for image in images:
        if image.handover_id != handover.pk:
            image.handover = handover
            image.save(update_fields=["handover"])


def handover_snapshot(handover):
    return {
        "id": handover.pk,
        "region": handover.region,
        "priority": handover.priority,
        "status": handover.status,
        "category": handover.category,
        "title": handover.title,
        "content_html": handover.content_html,
        "author_name": handover.author_name,
        "author_username": handover.author_username,
        "created_at": handover.created_at.isoformat(),
        "image_ids": list(handover.images.values_list("id", flat=True)),
    }


def serialize(handover, request):
    return RegionalHandoverSerializer(handover, context={"request": request}).data


def input_data(request):
    values = request.data.copy()
    values.pop("revision", None)
    return values


@method_decorator(csrf_protect, name="dispatch")
class RegionalHandoverListCreateView(APIView):
    permission_classes = [CanWrite]

    @transaction.atomic
    def get(self, request):
        state = lock_state()
        rows = handover_queryset()
        region = request.query_params.get("region")
        if region:
            if region not in dict(RegionalHandover.REGION_CHOICES):
                raise ValidationError({"region": ["권역은 KR, EU, NA 중에서 선택하세요."]})
            rows = rows.filter(region=region)
        return Response({
            "revision": state.revision,
            "rows": RegionalHandoverSerializer(rows, many=True, context={"request": request}).data,
        })

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        serializer = RegionalHandoverSerializer(data=input_data(request), context={"request": request})
        serializer.is_valid(raise_exception=True)
        images = resolve_images(request.user, content_image_ids(serializer))
        capture_history(request, "regional_handovers")
        handover = serializer.save(
            author=request.user,
            author_name=display_name(request.user),
            author_username=request.user.username,
        )
        sync_images(handover, images)
        handover = handover_queryset().get(pk=handover.pk)
        after = handover_snapshot(handover)
        bump(state)
        record_log(request, "regional_handovers", "create", f"핸드오버 등록 · {handover.title}", after=after)
        record_activity(
            request, "create", f"권역별 핸드오버 #{handover.pk} 등록: {handover.title}",
            "regional_handover", handover.pk, after=after,
        )
        return Response({"revision": state.revision, "row": serialize(handover, request)}, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class RegionalHandoverDetailView(APIView):
    permission_classes = [CanWrite]

    def get_handover(self, pk, lock=False):
        rows = handover_queryset()
        if lock:
            rows = rows.select_for_update(of=("self",))
        return get_object_or_404(rows, pk=pk)

    def get(self, request, pk):
        return Response(serialize(self.get_handover(pk), request))

    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        handover = self.get_handover(pk, lock=True)
        if not (is_admin(request.user) or (can_write(request.user) and handover.author_id == request.user.pk)):
            raise PermissionDenied("작성자 또는 관리자만 핸드오버를 수정할 수 있습니다.")
        before = handover_snapshot(handover)
        serializer = RegionalHandoverSerializer(
            handover, data=input_data(request), partial=True, context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        images = None
        if "content_html" in request.data:
            images = resolve_images(request.user, content_image_ids(serializer), handover=handover)
        capture_history(request, "regional_handovers")
        handover = serializer.save()
        if images is not None:
            sync_images(handover, images)
        handover = handover_queryset().get(pk=handover.pk)
        after = handover_snapshot(handover)
        bump(state)
        record_log(request, "regional_handovers", "update", f"핸드오버 수정 · {handover.title}", before=before, after=after)
        record_activity(
            request, "update", f"권역별 핸드오버 #{handover.pk} 수정: {handover.title}",
            "regional_handover", handover.pk, before=before, after=after,
        )
        return Response({"revision": state.revision, "row": serialize(handover, request)})

    @transaction.atomic
    def delete(self, request, pk):
        if not is_admin(request.user):
            raise PermissionDenied("핸드오버는 관리자만 삭제할 수 있습니다.")
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        handover = self.get_handover(pk, lock=True)
        before = handover_snapshot(handover)
        title = handover.title
        capture_history(request, "regional_handovers")
        handover.delete()
        bump(state)
        record_log(request, "regional_handovers", "delete", f"핸드오버 삭제 · {title}", before=before)
        record_activity(
            request, "delete", f"권역별 핸드오버 #{pk} 삭제: {title}",
            "regional_handover", pk, before=before,
        )
        return Response({"revision": state.revision})


@method_decorator(csrf_protect, name="dispatch")
class ImageUploadView(APIView):
    permission_classes = [CanWrite]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": ["이미지 파일을 선택하세요."]})
        if upload.size > MAX_IMAGE_BYTES:
            raise ValidationError({"file": ["이미지는 5MB까지 업로드할 수 있습니다."]})
        try:
            upload.seek(0)
            with Image.open(upload) as image:
                image_format = (image.format or "").upper()
                width, height = image.size
                frames = getattr(image, "n_frames", 1)
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
            raise ValidationError({"file": ["유효한 이미지 파일이 아닙니다."]}) from exc
        finally:
            upload.seek(0)
        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise ValidationError({"file": ["PNG, JPEG, GIF, WebP 이미지만 사용할 수 있습니다."]})
        if width * height > MAX_IMAGE_PIXELS or frames > MAX_IMAGE_FRAMES:
            raise ValidationError({"file": ["이미지 해상도 또는 프레임 수가 너무 큽니다."]})

        cutoff = timezone.now() - timedelta(days=1)
        lock_state()
        for orphan in RegionalHandoverImage.objects.filter(
            uploader=request.user, handover__isnull=True, created_at__lt=cutoff,
        ):
            record_log(request, "regional_handovers", "delete", "핸드오버 미첨부 이미지 정리",
                       before={"id": orphan.pk, "original_name": orphan.original_name})
            orphan.delete()
        image = RegionalHandoverImage.objects.create(
            uploader=request.user,
            file=upload,
            original_name=upload.name[:255],
        )
        record_log(request, "regional_handovers", "create", "핸드오버 이미지 업로드", after={"id": image.pk, "original_name": image.original_name})
        return Response(RegionalHandoverImageSerializer(image).data, status=status.HTTP_201_CREATED)


class ImageServeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        image = get_object_or_404(RegionalHandoverImage, pk=pk)
        if image.handover_id is None and image.uploader_id != request.user.pk:
            raise Http404
        try:
            handle = image.file.open("rb")
        except FileNotFoundError as exc:
            raise Http404("이미지를 찾을 수 없습니다.") from exc
        content_type = mimetypes.guess_type(image.file.name)[0] or "application/octet-stream"
        try:
            with Image.open(image.file) as source:
                content_type = CONTENT_TYPES.get((source.format or "").upper(), content_type)
        except (UnidentifiedImageError, OSError):
            pass
        finally:
            image.file.seek(0)
        response = FileResponse(handle, content_type=content_type)
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Disposition"] = "inline"
        return response
