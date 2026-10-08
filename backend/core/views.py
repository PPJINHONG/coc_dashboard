import logging

from django.db import DatabaseError, connection
from django.shortcuts import render
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ErrorSerializer, TestListSerializer

logger = logging.getLogger(__name__)


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
