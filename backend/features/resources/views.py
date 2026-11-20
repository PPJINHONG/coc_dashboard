from datetime import date

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import record_activity
from reporting.history import capture_history
from reporting.months import month_label, request_month
from reporting.permissions import ReportingPermission
from reporting.services import bump, check_revision, lock_state, record_log

from .models import InfrastructureResource
from .serializers import ResourceSerializer


def resource_input(request, *, creating=False):
    values = request.data.copy()
    values.pop("revision", None)
    values.pop("month", None)
    supplied_id = values.pop("id", None)
    if supplied_id is not None:
        message = "새 자원에는 번호를 지정할 수 없습니다." if creating else "자원 번호는 변경할 수 없습니다."
        raise ValidationError({"id": message})
    return values


def resource_snapshot(resource):
    return dict(ResourceSerializer(resource).data)


@method_decorator(csrf_protect, name="dispatch")
class ResourceListCreateView(APIView):
    permission_classes = [ReportingPermission]

    @transaction.atomic
    def post(self, request):
        month = request_month(request)
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        serializer = ResourceSerializer(data=resource_input(request, creating=True))
        serializer.is_valid(raise_exception=True)
        capture_history(request, "resources")
        try:
            with transaction.atomic():
                resource = serializer.save(period_month=month)
        except IntegrityError as exc:
            raise ValidationError({"non_field_errors": ["같은 기준 월의 리전·서비스 자원이 이미 있습니다."]}) from exc
        after = resource_snapshot(resource)
        bump(state)
        summary = f"{month_label(month)} 인프라 자원 #{resource.pk} 등록"
        record_log(request, "resources", "create", summary, after=after, month=month)
        record_activity(request, "create", summary, "infrastructure_resource", resource.pk, after=after)
        return Response({"revision": state.revision, "row": after}, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class ResourceDetailView(APIView):
    permission_classes = [ReportingPermission]

    @transaction.atomic
    def patch(self, request, pk):
        month = request_month(request)
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        resource = get_object_or_404(
            InfrastructureResource.objects.select_for_update(),
            pk=pk,
            period_month=month,
        )
        before = resource_snapshot(resource)
        serializer = ResourceSerializer(
            resource,
            data=resource_input(request),
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        capture_history(request, "resources")
        try:
            with transaction.atomic():
                resource = serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"non_field_errors": ["같은 기준 월의 리전·서비스 자원이 이미 있습니다."]}) from exc
        after = resource_snapshot(resource)
        bump(state)
        summary = f"{month_label(month)} 인프라 자원 #{resource.pk} 수정"
        record_log(request, "resources", "update", summary, before=before, after=after, month=month)
        record_activity(request, "update", summary, "infrastructure_resource", resource.pk, before=before, after=after)
        return Response({"revision": state.revision, "row": after})

    @transaction.atomic
    def delete(self, request, pk):
        month = request_month(request)
        state = lock_state()
        check_revision(state, request.data.get("revision"))
        resource = get_object_or_404(
            InfrastructureResource.objects.select_for_update(),
            pk=pk,
            period_month=month,
        )
        before = resource_snapshot(resource)
        capture_history(request, "resources")
        resource.delete()
        bump(state)
        summary = f"{month_label(month)} 인프라 자원 #{pk} 삭제"
        record_log(request, "resources", "delete", summary, before=before, month=month)
        record_activity(request, "delete", summary, "infrastructure_resource", pk, before=before)
        return Response({"revision": state.revision})


class ResourceTrendView(APIView):
    permission_classes = [ReportingPermission]

    def get(self, request):
        end = request_month(request)
        length = request.query_params.get("months", "3")
        if length not in {"1", "2", "3", "6", "12"}:
            raise ValidationError({"months": "지원하지 않는 조회 기간입니다."})
        first = end.year * 12 + end.month - int(length)
        if first < 12:
            raise ValidationError({"month": "조회 가능한 기준 월을 선택하세요."})
        start = date(first // 12, first % 12 + 1, 1)
        rows = InfrastructureResource.objects.filter(period_month__range=(start, end)).values(
            "period_month", "region", "host_count", "vm_count", "compute_rack_count", "storage_count",
        )
        months = {}
        for row in rows:
            month = row.pop("period_month").strftime("%Y-%m")
            months.setdefault(month, []).append(row)
        return Response(months)
