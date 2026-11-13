"""서버 시작 시(ensure_admin) 없을 때만 만드는 기본 계정. 이미 있는 계정의 비밀번호·권한은 바꾸지 않습니다.

비밀번호가 아이디와 같으므로 운영(EC2)에서는 처음 로그인한 뒤 DB 관리 > 사용자·권한에서 바꾸세요.
기본 계정은 @ 없는 아이디를 그대로 쓸 수 있습니다(새 계정은 이메일 아이디).
"""

from .roles import ROLE_ADMIN, ROLE_GROUP_LEAD, ROLE_OBSERVER

# (아이디, 비밀번호, 표시 이름, 권한, 그룹장 관리 국가)
DEFAULT_ACCOUNTS = (
    ("admin", "admin", "admin", ROLE_ADMIN, ()),
    ("kr", "kr", "KR", ROLE_GROUP_LEAD, ("KR",)),
    ("eu", "eu", "EU", ROLE_GROUP_LEAD, ("EU",)),
    ("na", "na", "NA", ROLE_GROUP_LEAD, ("NA",)),
    ("readonly", "readonly", "readonly", ROLE_OBSERVER, ()),
)
DEFAULT_USERNAMES = frozenset(account[0] for account in DEFAULT_ACCOUNTS)
