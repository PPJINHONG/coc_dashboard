"""서버 시작 시 없는 경우에만 생성하는 기본 관리자 계정."""

from .roles import ROLE_ADMIN

# (로그인 이름, 비밀번호, 표시 이름, 권한, 관리 국가 호환값)
DEFAULT_ACCOUNTS = (("admin", "admin", "admin", ROLE_ADMIN, ()),)
DEFAULT_USERNAMES = frozenset({"admin"})
