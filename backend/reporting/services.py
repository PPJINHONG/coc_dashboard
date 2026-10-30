from rest_framework.exceptions import APIException

from .models import ChangeLog, DataState, InfrastructureResource, RegionalIssue, StaffAssignment, WorkSummary
from .serializers import IssueSerializer, ResourceSerializer, StaffSerializer, WorkSerializer

SECTIONS = {
    'resources': (InfrastructureResource, ResourceSerializer, ('region', 'service', 'environment_name')),
    'staff': (StaffAssignment, StaffSerializer, ('staff',)),
    'work': (WorkSummary, WorkSerializer, ('region', 'work_type', 'scope')),
    'issues': (RegionalIssue, IssueSerializer, ()),
}


class Conflict(APIException):
    status_code = 409
    default_detail = '다른 변경 사항이 있습니다. 최신 데이터를 불러온 뒤 다시 수정하세요.'


def lock_state():
    DataState.objects.get_or_create(pk=1)
    return DataState.objects.select_for_update().get(pk=1)


def actor(request):
    if request.user.is_authenticated:
        return {'actor_name': request.user.get_full_name() or request.user.username, 'actor_username': request.user.username}
    return {'actor_name': '개발 사용자', 'actor_username': 'development'}


def record_log(request, section, action, summary, before=None, after=None):
    ChangeLog.objects.create(section=section, action=action, summary=summary, before_data=before or {}, after_data=after or {}, **actor(request))


def check_revision(state, revision):
    if type(revision) is not int or revision != state.revision:
        raise Conflict()


def bump(state):
    state.revision += 1
    state.save(update_fields=['revision', 'updated_at'])


def section_rows(section):
    model = SECTIONS[section][0]
    if section == 'staff':
        return model.objects.select_related('staff')
    qs = model.objects.select_related('region')
    if section == 'resources':
        qs = qs.select_related('service')
    if section == 'issues':
        qs = qs.select_related('owner').prefetch_related('comments')
    return qs


def totals():
    resources = list(section_rows('resources'))
    work = list(section_rows('work'))
    return {
        'hosts': sum(row.host_count for row in resources),
        'vms': sum(row.vm_count or 0 for row in resources),
        'storage': sum(row.storage_count or 0 for row in resources),
        'missing_vm_rows': sum(row.vm_count is None for row in resources),
        'missing_storage_rows': sum(row.storage_count is None for row in resources),
        'staff': section_rows('staff').count(),
        'work_total': sum(row.total_count for row in work),
        'work_completed': sum(row.completed_count for row in work),
    }
