from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed

from core.roles import assignable_roles, can_manage_members
from database_admin.accounts import AccountsView, AccountView, AccountSerializer, account_context


class MemberManager(BasePermission):
    message = '회원관리는 활성 관리자와 팀장만 사용할 수 있습니다.'

    def has_permission(self, request, view):
        return can_manage_members(request.user)


class MembersView(AccountsView):
    permission_classes = [MemberManager]

    def get(self, request):
        accounts = get_user_model().objects.prefetch_related('groups').order_by('username', 'id')
        return Response({
            'accounts': AccountSerializer(accounts, many=True, context=account_context(request)).data,
            'assignable_roles': [{'value': role, 'label': label} for role, label in assignable_roles(request.user)],
        })


class MemberView(AccountView):
    permission_classes = [MemberManager]

    # 회원 관리는 상태 변경으로 처리하며 실제 계정 삭제는 관리자 DB 관리에만 둡니다.
    def delete(self, request, pk):
        raise MethodNotAllowed('DELETE')
