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
    totals=lambda: {'staff': SECTION.rows().count()},
)
