from reporting.registry import Feature, Section
from reporting.models import StaffMember

from .models import StaffAssignment, StaffCalendarEvent, StaffResponsibility, StaffChoice
from .serializers import StaffSerializer

SECTION = Section(
    key='staff',
    model=StaffAssignment,
    serializer=StaffSerializer,
    unique_fields=('staff',),
    related=('staff', 'account'),
    prefetch=('calendar_events',),
    history_models=(StaffMember, StaffAssignment, StaffCalendarEvent, StaffResponsibility, StaffChoice),
    private_fields=('grade',),
)

FEATURE = Feature(
    tabs=('staff',),
    tables={'ops_staff_assignments': '운영 인력 배치', 'ops_staff_calendar_events': '인력 캘린더', 'ops_staff_responsibilities': '권역별 책임자', 'ops_staff_choices': '운영 인력 선택지'},
    sections=(SECTION,),
    # 운영 인력은 월 구분이 없어 기준 월과 관계없이 전체 인원을 셉니다.
    totals=lambda month: {'staff': SECTION.rows().count()},
)
