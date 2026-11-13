"""계정 권한(관리자·옵저버·사용자)과 사용자 행동 이력 공용 도구.

- 관리자(admin): is_staff=True. 모든 글·댓글을 수정·삭제하고 모든 이력을 확인합니다.
- 옵저버(observer): 'observer' 그룹. 조회만 가능합니다.
- 사용자(user): 그 외 활성 계정. 글·댓글을 작성하고 본인이 저장한 데이터만 수정·삭제합니다.
"""

from django.contrib.auth.models import Group
from django.contrib.sessions.models import Session
from django.utils import timezone
from rest_framework.permissions import BasePermission

from .models import UserActivity

ROLE_ADMIN, ROLE_OBSERVER, ROLE_USER = "admin", "observer", "user"
# 팀장: 운영 인력 전체 국가 편집. 그룹장: 관리 국가(KR·EU·NA 중 하나 이상)의 운영 인력만 편집. 그 밖에는 사용자와 같습니다.
ROLE_TEAM_LEAD, ROLE_GROUP_LEAD = "team_lead", "group_lead"
COUNTRIES = ("KR", "EU", "NA")
TEAM_LEAD_GROUP = "team_lead"
GROUP_LEAD_PREFIX = "group_lead_"  # 그룹 이름 group_lead_KR 등. 한 사람이 여러 국가를 맡을 수 있습니다.
ROLES = [(ROLE_ADMIN, "관리자"), (ROLE_TEAM_LEAD, "팀장"), (ROLE_GROUP_LEAD, "그룹장"), (ROLE_OBSERVER, "옵저버(읽기 전용)"), (ROLE_USER, "사용자")]
ROLE_LEVELS = {ROLE_ADMIN: 3, ROLE_TEAM_LEAD: 2, ROLE_GROUP_LEAD: 1, ROLE_USER: 0, ROLE_OBSERVER: 0}
OBSERVER_GROUP = "observer"
READ_ONLY_MESSAGE = "읽기 전용(옵저버) 계정은 데이터를 변경할 수 없습니다."


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_staff:
        return ROLE_ADMIN
    names = set(user.groups.values_list("name", flat=True))
    if OBSERVER_GROUP in names:
        return ROLE_OBSERVER
    if TEAM_LEAD_GROUP in names:
        return ROLE_TEAM_LEAD
    if any(name.startswith(GROUP_LEAD_PREFIX) for name in names):
        return ROLE_GROUP_LEAD
    return ROLE_USER


def managed_countries(user):
    """그룹장이 맡은 국가 목록(KR·EU·NA 순서). 그룹장이 아니면 빈 목록입니다."""
    if not user or not user.is_authenticated:
        return []
    names = set(user.groups.values_list("name", flat=True))
    return [code for code in COUNTRIES if f"{GROUP_LEAD_PREFIX}{code}" in names]


def staff_edit_countries(user):
    """운영 인력을 편집할 수 있는 국가. 관리자·팀장은 전체, 그룹장은 관리 국가, 그 외는 없음."""
    if not user or not user.is_authenticated or not user.is_active:
        return []
    role = user_role(user)
    if role in (ROLE_ADMIN, ROLE_TEAM_LEAD):
        return list(COUNTRIES)
    if role == ROLE_GROUP_LEAD:
        return managed_countries(user)
    return []


def is_admin(user):
    return bool(user and user.is_authenticated and user.is_active and user.is_staff)


def can_manage_members(user):
    return bool(user and user.is_authenticated and user.is_active and user_role(user) in (ROLE_ADMIN, ROLE_TEAM_LEAD))


def assignable_roles(user):
    if not can_manage_members(user):
        return []
    level = ROLE_LEVELS[user_role(user)]
    return [(role, label) for role, label in ROLES if ROLE_LEVELS[role] < level]


def can_manage_account(actor, target):
    return bool(can_manage_members(actor) and actor.pk != target.pk and not target.is_superuser
                and ROLE_LEVELS.get(user_role(target), 3) < ROLE_LEVELS[user_role(actor)])


def can_write(user):
    return bool(user and user.is_authenticated and user.is_active and user_role(user) != ROLE_OBSERVER)


def owns(user, username):
    return bool(username) and username.lower() == user.username.lower()


def can_modify(user, author_username):
    """관리자이거나, 쓰기 권한이 있는 작성자 본인이면 수정·삭제할 수 있습니다."""
    return is_admin(user) or (can_write(user) and owns(user, author_username))


def apply_role(user, role, countries=None):
    """권한을 저장합니다. is_staff는 관리자 여부, 옵저버·팀장·그룹장(관리 국가별)은 그룹 소속으로 구분합니다."""
    user.is_staff = role == ROLE_ADMIN
    user.save(update_fields=["is_staff"])
    wanted = set()
    if role == ROLE_OBSERVER:
        wanted.add(OBSERVER_GROUP)
    elif role == ROLE_TEAM_LEAD:
        wanted.add(TEAM_LEAD_GROUP)
    elif role == ROLE_GROUP_LEAD:
        wanted.update(f"{GROUP_LEAD_PREFIX}{code}" for code in (countries or []) if code in COUNTRIES)
    managed = [OBSERVER_GROUP, TEAM_LEAD_GROUP, *(f"{GROUP_LEAD_PREFIX}{code}" for code in COUNTRIES)]
    for name in managed:
        group, _ = Group.objects.get_or_create(name=name)
        if name in wanted:
            user.groups.add(group)
        else:
            user.groups.remove(group)


class CanWrite(BasePermission):
    message = READ_ONLY_MESSAGE

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return bool(request.user and request.user.is_authenticated)
        return can_write(request.user)


def display_name(user):
    return user.get_full_name() or user.first_name or user.username


def diff(before, after):
    """두 스냅샷에서 바뀐 항목만 {항목: {before, after}} 형태로 돌려줍니다."""
    keys = [key for key in dict.fromkeys([*(before or {}), *(after or {})])]
    return {
        key: {"before": (before or {}).get(key), "after": (after or {}).get(key)}
        for key in keys
        if (before or {}).get(key) != (after or {}).get(key)
    }


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    value = (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None
    return value


def record_activity(request, action, summary, target_type="", target_id="", before=None, after=None, user=None):
    """행동 이력 1건을 저장합니다. 수정이면 변경 항목(changes)도 함께 남깁니다."""
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
        ip_address=client_ip(request) if request is not None else None,
    )


def online_sessions():
    """만료되지 않은 로그인 세션 수를 계정 id별로 돌려줍니다."""
    counts = {}
    for session in Session.objects.filter(expire_date__gt=timezone.now()):
        try:
            user_id = session.get_decoded().get("_auth_user_id")
        except Exception:  # 손상되거나 서명 키가 바뀐 세션은 무시합니다.
            continue
        if user_id is not None:
            counts[int(user_id)] = counts.get(int(user_id), 0) + 1
    return counts
