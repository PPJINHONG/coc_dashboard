from reporting.registry import Feature, Section

from .models import WorkSummary
from .serializers import WorkSerializer

SECTION = Section(
    key='work',
    model=WorkSummary,
    serializer=WorkSerializer,
    unique_fields=('region', 'work_type', 'scope'),
    related=('region',),
)


def totals(month):
    rows = list(SECTION.scoped(month))
    return {
        'work_total': sum(row.total_count for row in rows),
        'work_completed': sum(row.completed_count for row in rows),
    }


FEATURE = Feature(
    tabs=('work',),
    tables={'ops_work_summaries': '운영 작업'},
    sections=(SECTION,),
    totals=totals,
)
