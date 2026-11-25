from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed

from core.roles import ROLES, is_admin
from database_admin.accounts import AccountPasswordResetView, AccountsView, AccountView, AccountSerializer, account_context


class MemberManager(BasePermission):
    message = "회원관리는 활성 관리자만 사용할 수 있습니다."

    def has_permission(self, request, view):
        return is_admin(request.user)


class MembersView(AccountsView):
    permission_classes = [MemberManager]

    def get(self, request):
        accounts = get_user_model().objects.order_by("first_name", "id")
        return Response({
            "accounts": AccountSerializer(accounts, many=True, context=account_context(request)).data,
            "assignable_roles": [{"value": role, "label": label} for role, label in ROLES],
        })


class MemberView(AccountView):
    permission_classes = [MemberManager]

    def delete(self, request, pk):
        raise MethodNotAllowed("DELETE")


class MemberPasswordResetView(AccountPasswordResetView):
    permission_classes = [MemberManager]
