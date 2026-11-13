import pytest

from core.roles import ROLE_GROUP_LEAD, ROLE_OBSERVER, ROLE_TEAM_LEAD
from features.staff.models import StaffAssignment
from reporting.models import ChangeLog
from .test_staff_edit import URL, assignment, login, row


@pytest.mark.django_db
def test_create_and_update_one_person_preserves_other_people():
    kept = assignment('기존 인력', 'KR')
    client, _ = login(ROLE_TEAM_LEAD)
    response = client.post(URL, {'revision': 0, 'person': row('신규 인력', 'EU', work_location='독일 프랑크푸르트')}, format='json')
    assert response.status_code == 201, response.data
    person = response.data['person']
    assert person['can_edit'] is True
    response = client.patch(URL, {'revision': 1, 'person': row('수정 인력', 'NA', id=person['id'])}, format='json')
    assert response.status_code == 200, response.data
    kept.refresh_from_db()
    assert kept.staff.staff_name == '기존 인력'
    assert StaffAssignment.objects.count() == 2
    assert ChangeLog.objects.filter(section='staff').count() == 2
    assert client.patch(URL, {'revision': 1, 'person': row('충돌', 'NA', id=person['id'])}, format='json').status_code == 409


@pytest.mark.django_db
def test_group_lead_cannot_change_another_region_or_move_out_of_scope():
    eu = assignment('유럽', 'EU')
    kr = assignment('한국', 'KR')
    client, _ = login(ROLE_GROUP_LEAD, ('KR',))
    for person in [row('유럽', 'KR', id=eu.pk), row('한국', 'EU', id=kr.pk)]:
        assert client.patch(URL, {'revision': 0, 'person': person}, format='json').status_code == 403
    assert client.post(URL, {'revision': 0, 'person': row('유럽', 'EU')}, format='json').status_code == 403
    assert client.post(URL, {'revision': 0, 'person': row('한국 추가', 'KR')}, format='json').status_code == 201


@pytest.mark.django_db
@pytest.mark.parametrize('role', [None, ROLE_OBSERVER])
def test_person_write_requires_management_permission(role):
    person = assignment('한국', 'KR')
    client, _ = login(role)
    assert client.post(URL, {'revision': 0, 'person': row('신규', 'KR')}, format='json').status_code == 403
    assert client.patch(URL, {'revision': 0, 'person': row('수정', 'KR', id=person.pk)}, format='json').status_code == 403


@pytest.mark.django_db
def test_creation_and_edit_cannot_be_confused():
    person = assignment('한국', 'KR')
    client, _ = login(ROLE_TEAM_LEAD)
    assert client.post(URL, {'revision': 0, 'person': row('신규', 'KR', id=person.pk)}, format='json').status_code == 400
    assert client.patch(URL, {'revision': 0, 'person': row('수정', 'KR')}, format='json').status_code == 400
    assert client.post(URL, {'revision': 0, 'person': row(' ', 'KR')}, format='json').status_code == 400
    assert StaffAssignment.objects.count() == 1


@pytest.mark.django_db
def test_group_lead_cannot_select_or_edit_a_higher_title():
    higher = assignment('팀장', 'KR')
    higher.job_title = '팀장'
    higher.save()
    client, _ = login(ROLE_GROUP_LEAD, ('KR',))
    listed = client.get('/api/operations/current/').data['staff']
    assert listed[0]['can_edit'] is False
    assert client.post(URL, {'revision': 0, 'person': row('새 팀장', 'KR', job_title='팀장')}, format='json').status_code == 403
    assert client.patch(URL, {'revision': 0, 'person': row('직책 변경', 'KR', id=higher.pk, job_title='책임')}, format='json').status_code == 403
    assert client.put(URL, {'revision': 0, 'rows': [row('새 팀장', 'KR', job_title='팀장')]}, format='json').status_code == 403
    # 과거 일괄 API에서도 상위 직책 인력은 누락을 이유로 삭제하지 않습니다.
    assert client.put(URL, {'revision': 0, 'rows': []}, format='json').status_code == 200
    assert StaffAssignment.objects.filter(pk=higher.pk).exists()
