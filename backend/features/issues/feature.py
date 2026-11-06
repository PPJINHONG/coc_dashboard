from reporting.registry import Feature, Section

from .models import RegionalIssue
from .serializers import IssueSerializer

SECTION = Section(
    key='issues',
    model=RegionalIssue,
    serializer=IssueSerializer,
    # 이슈는 같은 리전에 여러 건이 있을 수 있으므로 id 없는 행은 항상 새로 추가합니다.
    unique_fields=(),
    related=('region', 'owner'),
    prefetch=('comments',),
)

FEATURE = Feature(
    tabs=('issues',),
    tables={
        'ops_regional_issues': '리전 이슈·조치',
        'ops_issue_comments': '이슈 댓글',
    },
    sections=(SECTION,),
)
