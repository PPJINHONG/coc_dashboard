"""운영 데이터 저장에 쓰는 공통 도구: 동시 수정 버전, 변경 이력, 작업자 이름."""

from rest_framework.exceptions import APIException

from .models import ChangeLog, DataState


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


def record_log(request, section, action, summary, before=None, after=None, month=None):
    """운영 변경 이력을 남깁니다. 월별 기능 데이터는 기준 월(month, 그 달 1일)을 함께 저장합니다."""
    ChangeLog.objects.create(section=section, action=action, summary=summary, before_data=before or {}, after_data=after or {},
                             period_month=month, **actor(request))


def check_revision(state, revision):
    if type(revision) is not int or revision != state.revision:
        raise Conflict()


def bump(state):
    state.revision += 1
    state.save(update_fields=['revision', 'updated_at'])
