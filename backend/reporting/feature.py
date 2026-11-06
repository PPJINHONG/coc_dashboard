from .registry import Feature

# 리포트·변경 이력 탭은 이 공통 앱의 데이터를 보여 줍니다. 공통데이터 테이블은 DB 원본에서 조회합니다.
FEATURE = Feature(
    tabs=('report', 'logs'),
    tables={
        'ops_regions': '공통 리전',
        'ops_services': '인프라 서비스',
        'ops_staff_members': '인력 기준정보',
    },
)
