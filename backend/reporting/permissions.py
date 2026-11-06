"""운영 데이터 API 권한. 기능 앱도 같은 규칙을 사용합니다."""

from django.conf import settings
from rest_framework.permissions import SAFE_METHODS, BasePermission


def can_manage(request):
    """실제로 로그인한 활성 관리자인지 확인합니다. 개발용 로그인 우회와 무관합니다."""
    return bool(request.user.is_authenticated and request.user.is_active and request.user.is_staff)


class ReportingPermission(BasePermission):
    """조회는 로그인 사용자(개발 모드면 누구나), 변경은 관리자만 허용합니다."""

    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS:
            return can_manage(request)
        return settings.DEVELOPMENT_AUTH_BYPASS or request.user.is_authenticated


class OperationsAdministrator(BasePermission):
    message = '데이터 변경은 DB 관리에서 로그인한 관리자만 할 수 있습니다.'

    def has_permission(self, request, view):
        return can_manage(request)
