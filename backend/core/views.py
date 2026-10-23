import logging

from django.contrib.auth import authenticate, login, logout
from django.db import DatabaseError, connection
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ErrorSerializer, LoginSerializer, MeSerializer, TestListSerializer

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
