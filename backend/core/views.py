"""세션 로그인·회원가입·로그아웃·내 정보 조회 API."""

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from invites.services import invite_error, redeem_invite

from .serializers import LoginSerializer, MeSerializer, RegisterSerializer

LOGIN_FAIL_DETAIL = "아이디 또는 비밀번호가 올바르지 않습니다."


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


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterSerializer, responses={201: MeSerializer})
    def post(self, request):
        # 회원가입은 팀원이 발급한 초대 링크로만 할 수 있습니다.
        invite_token = request.data.get("invite") if hasattr(request.data, "get") else None
        serializer = RegisterSerializer(data=request.data)
        valid = serializer.is_valid()
        errors = dict(serializer.errors) if not valid else {}
        invite_problem = invite_error(invite_token)
        if invite_problem is not None:
            errors.update(invite_problem.detail)
        if errors:
            raise ValidationError(errors)
        try:
            with transaction.atomic():
                user = serializer.save()
                redeem_invite(invite_token, user)
        except IntegrityError:
            return Response({"username": ["이미 사용 중인 이메일 아이디입니다."]}, status=400)
        login(request, user)
        return Response(MeSerializer(user).data, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    """내 정보는 조회만 합니다. 계정 수정은 DB 관리 > 사용자·권한에서 처리합니다."""

    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer
    http_method_names = ["get", "head", "options"]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            raise ValidationError({"username": ["이미 사용 중인 이메일 아이디입니다."]})
        if "password" in serializer.validated_data:
            update_session_auth_hash(self.request, user)
