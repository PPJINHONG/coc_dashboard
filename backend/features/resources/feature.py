from reporting.registry import Feature, Section

from .models import InfrastructureResource
from .serializers import ResourceSerializer

SECTION = Section(
    key='resources',
    model=InfrastructureResource,
    serializer=ResourceSerializer,
    unique_fields=('region', 'service'),
    related=('region', 'service'),
)


def totals(month):
    rows = list(SECTION.scoped(month))
    return {
        'hosts': sum(row.host_count for row in rows),
        'vms': sum(row.vm_count or 0 for row in rows),
        'storage': sum(row.storage_count or 0 for row in rows),
        'missing_vm_rows': sum(row.vm_count is None for row in rows),
        'missing_storage_rows': sum(row.storage_count is None for row in rows),
    }


FEATURE = Feature(
    tabs=('resources',),
    tables={'infra_resources': '인프라 자원·호스트 수량'},
    sections=(SECTION,),
    totals=totals,
)
