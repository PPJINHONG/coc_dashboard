"""대시보드 패널 API (/api/dashboard/panels/...). 화면은 아직 메뉴에 연결하지 않았습니다.

패널은 사용자별입니다. 다른 사람의 패널은 있는지도 알려 주지 않도록 404로 응답합니다.
"""

from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DashboardPanel
from .serializers import DashboardPanelSerializer, PanelReorderSerializer


class DashboardPanelListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="내 대시보드 패널 목록", responses={200: DashboardPanelSerializer(many=True)})
    def get(self, request):
        panels = DashboardPanel.objects.filter(owner=request.user)
        return Response(DashboardPanelSerializer(panels, many=True).data)

    @extend_schema(summary="패널 추가", request=DashboardPanelSerializer, responses={201: DashboardPanelSerializer})
    def post(self, request):
        serializer = DashboardPanelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        last = DashboardPanel.objects.filter(owner=request.user).aggregate(m=Max("position"))["m"]
        panel = serializer.save(owner=request.user, position=(last if last is not None else -1) + 1)
        return Response(DashboardPanelSerializer(panel).data, status=status.HTTP_201_CREATED)


class DashboardPanelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_panel(self, request, pk):
        return get_object_or_404(DashboardPanel, pk=pk, owner=request.user)

    @extend_schema(summary="패널 조회", responses={200: DashboardPanelSerializer})
    def get(self, request, pk):
        return Response(DashboardPanelSerializer(self._get_panel(request, pk)).data)

    @extend_schema(summary="패널 수정(일부 항목만 보내도 됨)", request=DashboardPanelSerializer, responses={200: DashboardPanelSerializer})
    def patch(self, request, pk):
        panel = self._get_panel(request, pk)
        serializer = DashboardPanelSerializer(panel, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        panel = serializer.save()
        return Response(DashboardPanelSerializer(panel).data)

    @extend_schema(summary="패널 삭제", responses={204: None})
    def delete(self, request, pk):
        self._get_panel(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardPanelReorderView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="패널 순서 변경",
        description="내 패널 id 전체를 원하는 순서로 보냅니다. 빠지거나 남의 id가 섞이면 400입니다.",
        request=PanelReorderSerializer,
        responses={200: DashboardPanelSerializer(many=True)},
    )
    def post(self, request):
        serializer = PanelReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        panels = {p.id: p for p in DashboardPanel.objects.filter(owner=request.user)}
        if len(ids) != len(set(ids)) or set(ids) != set(panels):
            return Response(
                {"ids": ["내 패널 id를 빠짐없이 한 번씩 보내야 합니다."]}, status=status.HTTP_400_BAD_REQUEST
            )
        with transaction.atomic():
            for position, pid in enumerate(ids):
                panels[pid].position = position
            DashboardPanel.objects.bulk_update(panels.values(), ["position"])
        ordered = DashboardPanel.objects.filter(owner=request.user)
        return Response(DashboardPanelSerializer(ordered, many=True).data)
