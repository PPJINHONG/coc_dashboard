from reporting.registry import Feature, Section

from .models import StaffAssignment
from .serializers import StaffSerializer

SECTION = Section(
    key='staff',
    model=StaffAssignment,
    serializer=StaffSerializer,
    unique_fields=('staff',),
    related=('staff',),
)

FEATURE = Feature(
    tabs=('staff',),
    tables={'ops_staff_assignments': '운영 인력 배치'},
    sections=(SECTION,),
    # 운영 인력은 월 구분이 없어 기준 월과 관계없이 전체 인원을 셉니다.
    totals=lambda month: {'staff': SECTION.rows().count()},
)
