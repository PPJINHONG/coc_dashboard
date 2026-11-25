"""세션 로그인·회원가입·로그아웃·내 정보·비밀번호 변경 API."""

from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
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
from reporting.services import record_log

from .roles import record_activity
from .security import must_change_password, set_password_change_required
from .serializers import LoginSerializer, MeSerializer, PasswordChangeSerializer, RegisterSerializer

LOGIN_FAIL_DETAIL = "이름 또는 비밀번호가 올바르지 않습니다."


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login_name = serializer.validated_data["username"]
        account = get_user_model().objects.filter(username__iexact=login_name).first()
        user = authenticate(
            request,
            username=account.username if account else login_name,
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
                invite = redeem_invite(invite_token, user)
                record_log(request, "members", "create", f"초대 회원가입 · {user.first_name}", user=user,
                           after={"id": user.pk, "name": user.first_name, "email": user.email, "role": "user"})
                record_log(request, "invites", "update", f"초대 링크 #{invite.pk} 사용", user=user,
                           before={"use_count": invite.use_count - 1}, after={"use_count": invite.use_count})
        except IntegrityError:
            return Response({"detail": "이미 사용 중인 이름 또는 이메일입니다."}, status=400)
        login(request, user)
        return Response(MeSerializer(user).data, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


@method_decorator(csrf_protect, name="dispatch")
class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        was_required = must_change_password(user)
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        user.security_settings = set_password_change_required(user, False)
        update_session_auth_hash(request, user)
        before = {"must_change_password": was_required}
        after = {"must_change_password": False, "password_changed": True}
        record_log(request, "members", "update", f"비밀번호 변경 · {user.first_name}", before=before, after=after)
        record_activity(
            request,
            "update",
            "초기 비밀번호 변경",
            "account",
            user.pk,
            before=before,
            after=after,
            user=user,
        )
        return Response(MeSerializer(user).data)
