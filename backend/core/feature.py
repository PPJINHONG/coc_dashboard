from reporting.registry import Feature

# DB 관리 > DB 원본에서 조회할 계정·행동 이력 테이블입니다.
FEATURE = Feature(
    tables={
        'auth_user': '회원 계정·권한',
        'account_security': '회원 비밀번호 변경 상태',
        'user_activity_logs': '사용자 행동 이력',
    },
)
