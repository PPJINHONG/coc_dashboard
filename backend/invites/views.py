from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Invite


def _name(user):
    if user is None:
        return "탈퇴한 사용자"
    return user.first_name or user.username


def invite_create_serializer(user, data):
    """권한에 따라 고를 수 있는 기간·인원이 다릅니다. 범위 밖 값은 400으로 거절합니다."""
    options = services.invite_options(user)

    class InviteCreateSerializer(serializers.Serializer):
        expires_days = serializers.ChoiceField(
            choices=options["expires_days"], default=options["default_expires_days"]
        )
        max_uses = serializers.ChoiceField(choices=options["max_uses"], default=options["default_max_uses"])

    return InviteCreateSerializer(data=data)


def options_payload(user):
    options = services.invite_options(user)
    return {
        "expires_days": list(options["expires_days"]),
        "max_uses": list(options["max_uses"]),
        "default_expires_days": options["default_expires_days"],
        "default_max_uses": options["default_max_uses"],
    }


def invite_payload(invite: Invite):
    return {
        "id": invite.id,
        "token_hint": invite.token_hint,
        "created_by_name": _name(invite.created_by),
        "created_at": invite.created_at,
        "expires_at": invite.expires_at,
        "max_uses": invite.max_uses,
        "use_count": invite.use_count,
        "status": invite.status(),
        "joined": [_name(use.user) for use in invite.uses.all()],
    }


def _visible_invites(user):
    qs = Invite.objects.select_related("created_by").prefetch_related("uses__user")
    return qs if user.is_staff else qs.filter(created_by=user)


class InviteListCreateView(APIView):
    """로그인한 팀원은 누구나 초대 링크를 만들 수 있습니다. 관리자 승인은 필요 없습니다."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([invite_payload(invite) for invite in _visible_invites(request.user)[:50]])

    def post(self, request):
        serializer = invite_create_serializer(request.user, request.data)
        serializer.is_valid(raise_exception=True)
        invite, token = services.create_invite(
            request.user, serializer.validated_data["expires_days"], serializer.validated_data["max_uses"]
        )
        # 토큰 원문은 만들 때 한 번만 돌려줍니다.
        return Response({**invite_payload(invite), "token": token}, status=status.HTTP_201_CREATED)


class InviteOptionsView(APIView):
    """초대 창이 보여 줄 기간·인원 선택지입니다. 일반 팀원과 관리자가 다릅니다."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(options_payload(request.user))


class InviteRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        invite = get_object_or_404(_visible_invites(request.user), pk=pk)
        if invite.revoked_at is None:
            invite.revoked_at = timezone.now()
            invite.save(update_fields=["revoked_at"])
        return Response(invite_payload(invite))


class InviteCheckView(APIView):
    """가입 화면이 링크를 열 때 초대가 유효한지 확인합니다."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        invite, state = services.find_invite(token)
        if invite is None:
            return Response({"detail": services.STATUS_MESSAGES[state], "status": state}, status=404)
        return Response({"status": "active", "inviter_name": _name(invite.created_by), "expires_at": invite.expires_at})
