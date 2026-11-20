from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import display_name, record_activity
from reporting.history import capture_history
from reporting.months import request_month
from reporting.permissions import ReportingPermission
from reporting.services import bump, check_revision, lock_state, record_log

from .models import RegionalNotice
from .serializers import RegionalNoticeSerializer


COUNTRIES = ("KR", "NA", "EU")


def notice_queryset():
    return RegionalNotice.objects.select_related("region")


def notice_month(scheduled_at):
    return timezone.localtime(scheduled_at).date().replace(day=1)


def notice_snapshot(notice):
    return {
        "id": notice.pk,
        "month": notice.period_month.strftime("%Y-%m"),
        "region": notice.region_id,
        "region_name": notice.region_name,
        "country_code": notice.country,
        "scheduled_at": notice.scheduled_at.isoformat(),
        "title": notice.title,
        "content": notice.content,
        "category": notice.category,
        "author": notice.author,
    }


def serialize(notice, request):
    return RegionalNoticeSerializer(notice, context={"request": request}).data


def input_data(request):
    values = request.data.copy()
    values.pop("revision", None)
    return values


@method_decorator(csrf_protect, name="dispatch")
class RegionalNoticeListCreateView(APIView):
    permission_classes = [ReportingPermission]

    def get(self, request):
        month = request_month(request)
        rows = notice_queryset().filter(period_month=month)
        country = request.query_params.get("country")
        if country:
            if country not in COUNTRIES:
                raise ValidationError({"country": "리전은 KR, NA, EU 중에서 선택하세요."})
            rows = rows.filter(Q(country_code=country) | Q(region__country_code=country))
        return Response(RegionalNoticeSerializer(rows, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        serializer = RegionalNoticeSerializer(data=input_data(request), context={"request": request})
        serializer.is_valid(raise_exception=True)
        capture_history(request, "regional_notices")
        notice = serializer.save(
            period_month=notice_month(serializer.validated_data["scheduled_at"]),
            author=display_name(request.user),
        )
        notice = notice_queryset().get(pk=notice.pk)
        after = notice_snapshot(notice)
        bump(state)
        record_log(request, "regional_notices", "create", f"작업공지 #{notice.pk} 등록", after=after, month=notice.period_month)
        record_activity(request, "create", f"권역별 작업공지 #{notice.pk} 등록: {notice.title}", "regional_notice", notice.pk, after=after)
        return Response({"revision": state.revision, "row": serialize(notice, request)}, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class RegionalNoticeDetailView(APIView):
    permission_classes = [ReportingPermission]

    def get_notice(self, pk, lock=False):
        rows = notice_queryset()
        if lock:
            rows = rows.select_for_update(of=("self",))
        return get_object_or_404(rows, pk=pk)

    def get(self, request, pk):
        return Response(serialize(self.get_notice(pk), request))

    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        notice = self.get_notice(pk, lock=True)
        before = notice_snapshot(notice)
        serializer = RegionalNoticeSerializer(
            notice,
            data=input_data(request),
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        scheduled_at = serializer.validated_data.get("scheduled_at", notice.scheduled_at)
        capture_history(request, "regional_notices")
        notice = serializer.save(period_month=notice_month(scheduled_at))
        notice = notice_queryset().get(pk=notice.pk)
        after = notice_snapshot(notice)
        bump(state)
        record_log(request, "regional_notices", "update", f"작업공지 #{notice.pk} 수정", before=before, after=after, month=notice.period_month)
        record_activity(request, "update", f"권역별 작업공지 #{notice.pk} 수정: {notice.title}", "regional_notice", notice.pk, before=before, after=after)
        return Response({"revision": state.revision, "row": serialize(notice, request)})

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        notice = self.get_notice(pk, lock=True)
        before = notice_snapshot(notice)
        month = notice.period_month
        title = notice.title
        capture_history(request, "regional_notices")
        notice.delete()
        bump(state)
        record_log(request, "regional_notices", "delete", f"작업공지 #{pk} 삭제", before=before, month=month)
        record_activity(request, "delete", f"권역별 작업공지 #{pk} 삭제: {title}", "regional_notice", pk, before=before)
        return Response({"revision": state.revision})
