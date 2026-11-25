"""관리자와 일반 사용자(화면 표시: 책임) 권한 공용 도구."""

from django.contrib.auth.models import Group
from django.contrib.sessions.models import Session
from django.utils import timezone
from rest_framework.permissions import BasePermission

from .models import UserActivity

ROLE_ADMIN, ROLE_USER = "admin", "user"
# 과거 코드·마이그레이션 import 호환용 이름입니다. 현재 권한 판정에서는 모두 일반 사용자로 처리합니다.
ROLE_TEAM_LEAD, ROLE_GROUP_LEAD, ROLE_OBSERVER = "team_lead", "group_lead", "observer"
COUNTRIES = ("KR", "EU", "NA")
TEAM_LEAD_GROUP = "team_lead"
GROUP_LEAD_PREFIX = "group_lead_"
OBSERVER_GROUP = "observer"
ROLES = [(ROLE_ADMIN, "관리자"), (ROLE_USER, "책임")]
ROLE_LEVELS = {ROLE_ADMIN: 1, ROLE_USER: 0}
READ_ONLY_MESSAGE = "데이터 변경 권한이 없습니다."


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    return ROLE_ADMIN if user.is_staff else ROLE_USER


def managed_countries(user):
    return []


def staff_edit_countries(user):
    if not user or not user.is_authenticated or not user.is_active:
        return []
    return list(COUNTRIES) if is_admin(user) else []


def is_admin(user):
    return bool(user and user.is_authenticated and user.is_active and user.is_staff)


def can_manage_members(user):
    return is_admin(user)


def assignable_roles(user):
    return list(ROLES) if is_admin(user) else []


def can_manage_account(actor, target):
    return bool(is_admin(actor) and actor.pk != target.pk and not target.is_superuser)


def can_write(user):
    return bool(user and user.is_authenticated and user.is_active)


def owns(user, username):
    return bool(username) and username.casefold() == user.username.casefold()


def can_modify(user, author_username):
    return is_admin(user) or (can_write(user) and owns(user, author_username))


def apply_role(user, role, countries=None):
    """관리자 또는 일반 사용자 역할을 적용하고 과거 권한 그룹을 제거합니다."""
    user.is_staff = role == ROLE_ADMIN
    user.save(update_fields=["is_staff"])
    managed = [OBSERVER_GROUP, TEAM_LEAD_GROUP, *(f"{GROUP_LEAD_PREFIX}{code}" for code in COUNTRIES)]
    groups = Group.objects.filter(name__in=managed)
    if groups.exists():
        user.groups.remove(*groups)


class CanWrite(BasePermission):
    message = READ_ONLY_MESSAGE

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return bool(request.user and request.user.is_authenticated)
        return can_write(request.user)


def display_name(user):
    return user.get_full_name() or user.first_name or user.username


def diff(before, after):
    keys = [key for key in dict.fromkeys([*(before or {}), *(after or {})])]
    return {
        key: {"before": (before or {}).get(key), "after": (after or {}).get(key)}
        for key in keys
        if (before or {}).get(key) != (after or {}).get(key)
    }


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "") if request is not None else ""
    value = (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) if request is not None else None
    return value or None


def record_activity(request, action, summary, target_type="", target_id="", before=None, after=None, user=None):
    user = user if user is not None else request.user
    authenticated = bool(user and getattr(user, "is_authenticated", False))
    changes = diff(before, after) if action == "update" else {}
    return UserActivity.objects.create(
        user=user if authenticated else None,
        username=user.username if authenticated else str(getattr(user, "username", "") or ""),
        action=action,
        target_type=target_type,
        target_id=str(target_id or ""),
        summary=summary[:300],
        before_data=before or {},
        after_data=after or {},
        changes=changes,
        ip_address=client_ip(request),
    )


def online_sessions():
    counts = {}
    for session in Session.objects.filter(expire_date__gt=timezone.now()):
        try:
            user_id = session.get_decoded().get("_auth_user_id")
        except Exception:
            continue
        if user_id is not None:
            counts[int(user_id)] = counts.get(int(user_id), 0) + 1
    return counts
