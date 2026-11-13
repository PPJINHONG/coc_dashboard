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
from reporting.months import request_month
from reporting.services import bump, lock_state, record_log
from reporting.history import capture_history

from .models import RegionalRequest, RegionalRequestImage
from .serializers import RegionalRequestImageSerializer, RegionalRequestSerializer


ASSIGNMENT_FIELDS = {"status", "assignee_regions", "assignee_name"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_FRAMES = 120
MAX_IMAGES = 10
ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "GIF", "WEBP"}
CONTENT_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "GIF": "image/gif", "WEBP": "image/webp"}


def request_queryset():
    return RegionalRequest.objects.select_related("author").prefetch_related("images")


def image_ids(serializer):
    return serializer.context.get("content_image_ids", [])


def resolve_images(user, ids, ticket=None):
    ids = list(dict.fromkeys(ids))
    if len(ids) > MAX_IMAGES:
        raise ValidationError({"content_html": [f"이미지는 {MAX_IMAGES}개까지 넣을 수 있습니다."]})
    found = {image.pk: image for image in RegionalRequestImage.objects.filter(pk__in=ids)}
    resolved = []
    for image_id in ids:
        image = found.get(image_id)
        if image is None:
            raise ValidationError({"content_html": ["본문 이미지가 존재하지 않습니다."]})
        existing = ticket is not None and image.request_id == ticket.pk
        fresh = image.request_id is None and image.uploader_id == user.pk
        if not existing and not fresh:
            raise ValidationError({"content_html": ["직접 업로드했거나 이 요청에 첨부된 이미지만 사용할 수 있습니다."]})
        resolved.append(image)
    return resolved


def sync_images(ticket, images):
    keep_ids = {image.pk for image in images}
    for existing in ticket.images.all():
        if existing.pk not in keep_ids:
            existing.delete()
    for image in images:
        if image.request_id != ticket.pk:
            image.request = ticket
            image.save(update_fields=["request"])


def ticket_snapshot(ticket):
    return {
        "id": ticket.pk,
        "month": ticket.period_month.strftime("%Y-%m"),
        "region": ticket.region,
        "region_name": ticket.get_region_display(),
        "title": ticket.title,
        "content_html": ticket.content_html,
        "requester": ticket.requester,
        "requested_at": ticket.requested_at.isoformat(),
        "schedule_timezone": ticket.schedule_timezone,
        "schedule_start": ticket.schedule_start.isoformat(),
        "schedule_end": ticket.schedule_end.isoformat(),
        "status": ticket.status,
        "assignee_regions": ticket.assignee_regions,
        "assignee_name": ticket.assignee_name,
        "author_name": ticket.author_name,
        "image_ids": list(ticket.images.values_list("id", flat=True)),
    }


def serialize(ticket, request):
    return RegionalRequestSerializer(ticket, context={"request": request}).data


@method_decorator(csrf_protect, name="dispatch")
class RegionalRequestListCreateView(APIView):
    permission_classes = [CanWrite]

    def get(self, request):
        month = request_month(request)
        tickets = list(request_queryset().filter(period_month=month))
        region = request.query_params.get("region")
        if region:
            if region not in RegionalRequest.ASSIGNEE_REGION_CHOICES:
                raise ValidationError({"region": ["리전은 KR, NA, EU 중에서 선택하세요."]})
            tickets = [ticket for ticket in tickets if ticket.region == region]
        now = timezone.now()
        tickets.sort(key=lambda ticket: (abs((ticket.schedule_start - now).total_seconds()), ticket.schedule_start, ticket.pk))
        return Response(RegionalRequestSerializer(tickets, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        serializer = RegionalRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        images = resolve_images(request.user, image_ids(serializer))
        requested_at = timezone.now()
        period_month = timezone.localtime(requested_at).date().replace(day=1)
        capture_history(request, 'regional_requests')
        ticket = serializer.save(
            period_month=period_month,
            requested_at=requested_at,
            author=request.user,
            author_name=display_name(request.user),
            author_username=request.user.username,
        )
        sync_images(ticket, images)
        ticket = request_queryset().get(pk=ticket.pk)
        after = ticket_snapshot(ticket)
        bump(state)
        record_log(request, "regional_requests", "create", f"요청작업 #{ticket.pk} 등록", after=after, month=ticket.period_month)
        record_activity(request, "create", f"권역 요청작업 #{ticket.pk} 등록: {ticket.title}", "regional_request", ticket.pk, after=after)
        return Response({"revision": state.revision, "row": serialize(ticket, request)}, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class RegionalRequestDetailView(APIView):
    permission_classes = [CanWrite]

    def get_ticket(self, pk, lock=False):
        queryset = request_queryset()
        if lock:
            queryset = queryset.select_for_update(of=("self",))
        return get_object_or_404(queryset, pk=pk)

    def get(self, request, pk):
        return Response(serialize(self.get_ticket(pk), request))

    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        ticket = self.get_ticket(pk, lock=True)
        editable = is_admin(request.user) or (can_write(request.user) and ticket.author_id == request.user.pk)
        changed_fields = set(request.data)
        if not editable and not changed_fields.issubset(ASSIGNMENT_FIELDS):
            raise PermissionDenied("작성자 또는 관리자만 요청 내용을 수정할 수 있습니다.")
        before = ticket_snapshot(ticket)
        serializer = RegionalRequestSerializer(ticket, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        images = None
        if "content_html" in request.data:
            images = resolve_images(request.user, image_ids(serializer), ticket=ticket)
        capture_history(request, 'regional_requests')
        ticket = serializer.save()
        if images is not None:
            sync_images(ticket, images)
        ticket = request_queryset().get(pk=ticket.pk)
        after = ticket_snapshot(ticket)
        bump(state)
        record_log(request, "regional_requests", "update", f"요청작업 #{ticket.pk} 수정", before=before, after=after, month=ticket.period_month)
        record_activity(request, "update", f"권역 요청작업 #{ticket.pk} 수정: {ticket.title}", "regional_request", ticket.pk, before=before, after=after)
        return Response({"revision": state.revision, "row": serialize(ticket, request)})

    @transaction.atomic
    def delete(self, request, pk):
        if not is_admin(request.user):
            raise PermissionDenied("요청작업은 관리자만 삭제할 수 있습니다.")
        state = lock_state()
        ticket = self.get_ticket(pk, lock=True)
        before = ticket_snapshot(ticket)
        period_month = ticket.period_month
        title = ticket.title
        capture_history(request, 'regional_requests')
        ticket.delete()
        bump(state)
        record_log(request, "regional_requests", "delete", f"요청작업 #{pk} 삭제", before=before, month=period_month)
        record_activity(request, "delete", f"권역 요청작업 #{pk} 삭제: {title}", "regional_request", pk, before=before)
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
        for orphan in RegionalRequestImage.objects.filter(uploader=request.user, request__isnull=True, created_at__lt=cutoff):
            orphan.delete()
        image = RegionalRequestImage.objects.create(
            uploader=request.user,
            file=upload,
            original_name=upload.name[:255],
        )
        return Response(RegionalRequestImageSerializer(image).data, status=status.HTTP_201_CREATED)


class ImageServeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        image = get_object_or_404(RegionalRequestImage, pk=pk)
        if image.request_id is None and image.uploader_id != request.user.pk:
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
