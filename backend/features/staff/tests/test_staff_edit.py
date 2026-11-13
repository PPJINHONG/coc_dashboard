# 운영 인력 탭 편집 권한: 관리자·팀장은 전체, 그룹장은 관리 국가만, 사용자·옵저버는 403.
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.roles import ROLE_GROUP_LEAD, ROLE_OBSERVER, ROLE_TEAM_LEAD, apply_role, user_role
from features.issues.models import RegionalIssue
from features.staff.models import StaffAssignment
from reporting.models import ChangeLog, DataState, Region, StaffMember

URL = '/api/operations/staff/'


def login(role=None, countries=(), staff=False, name='person'):
    user = get_user_model().objects.create_user(username=f'{name}@example.com', password='x', is_staff=staff)
    if role:
        apply_role(user, role, countries)
    client = APIClient(enforce_csrf_checks=False)
    client.force_login(user)
    return client, user


def revision():
    state = DataState.objects.first()
    return state.revision if state else 0


def row(name, country, **values):
    return {'staff_name': name, 'country_code': country, **values}


def assignment(name, country):
    return StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name=name), country_code=country)


def rows_of(client):
    return client.get('/api/operations/current/').data['staff']


@pytest.mark.django_db
def test_team_lead_edits_all_countries_with_new_fields():
    client, user = login(ROLE_TEAM_LEAD, name='lead')
    assert user_role(user) == 'team_lead'
    response = client.put(URL, {'revision': 0, 'rows': [
        row('한국 인력', 'KR', pc_ip='10.0.0.1', autoever_account='0000001', z_account='Z000001'),
        row('유럽 인력', 'EU'),
        row('북미 인력', 'NA', job_title=''),
    ]}, format='json')
    assert response.status_code == 200, response.data
    assert StaffAssignment.objects.count() == 3
    kr = StaffAssignment.objects.get(country_code='KR')
    assert (kr.staff.staff_name, kr.pc_ip, kr.autoever_account, kr.z_account) == ('한국 인력', '10.0.0.1', '0000001', 'Z000001')
    assert all(item['can_edit'] for item in rows_of(client))
    assert ChangeLog.objects.filter(section='staff').exists()


@pytest.mark.django_db
def test_group_lead_only_edits_managed_country_and_keeps_others():
    eu = assignment('유럽 인력', 'EU')
    kr = assignment('한국 인력', 'KR')
    client, user = login(ROLE_GROUP_LEAD, ('KR',), name='kr-lead')
    assert user_role(user) == 'group_lead'
    listed = {item['staff_name']: item['can_edit'] for item in rows_of(client)}
    assert listed == {'유럽 인력': False, '한국 인력': True}
    # 다른 국가로 바꾸거나 다른 국가 행을 보내면 거절합니다.
    assert client.put(URL, {'revision': 0, 'rows': [row('한국 인력', 'EU', id=kr.pk)]}, format='json').status_code == 400
    assert client.put(URL, {'revision': 0, 'rows': [row('유럽 인력', 'EU', id=eu.pk)]}, format='json').status_code == 400
    assert client.put(URL, {'revision': 0, 'rows': [row('새 인력', 'NA')]}, format='json').status_code == 400
    # KR 행만 보내면 이름이 바뀌고, 빠진 KR 행만 삭제되며 EU 행은 남습니다.
    response = client.put(URL, {'revision': 0, 'rows': [row('한국 인력2', 'KR', id=kr.pk), row('새 인력', 'KR')]}, format='json')
    assert response.status_code == 200, response.data
    assert set(StaffAssignment.objects.values_list('staff__staff_name', flat=True)) == {'유럽 인력', '한국 인력2', '새 인력'}
    assert client.put(URL, {'revision': 1, 'rows': []}, format='json').status_code == 200
    assert list(StaffAssignment.objects.values_list('country_code', flat=True)) == ['EU']


@pytest.mark.django_db
def test_removed_staff_member_kept_when_used_by_issue():
    kept = assignment('담당자', 'KR')
    RegionalIssue.objects.create(region=Region.objects.create(region_name='리전'), title='이슈', owner=kept.staff)
    gone = assignment('삭제 대상', 'KR')
    client, _ = login(ROLE_TEAM_LEAD, name='lead')
    assert client.put(URL, {'revision': 0, 'rows': []}, format='json').status_code == 200
    assert not StaffAssignment.objects.exists()
    assert StaffMember.objects.filter(pk=kept.staff_id).exists()
    assert not StaffMember.objects.filter(pk=gone.staff_id).exists()


@pytest.mark.django_db
@pytest.mark.parametrize('role', [None, ROLE_OBSERVER])
def test_user_and_observer_cannot_edit(role):
    assignment('인력', 'KR')
    client, _ = login(role, name='plain')
    assert all(not item['can_edit'] for item in rows_of(client))
    assert client.put(URL, {'revision': 0, 'rows': []}, format='json').status_code == 403
    assert StaffAssignment.objects.count() == 1


@pytest.mark.django_db
def test_admin_edits_all_and_stale_revision_conflicts():
    client, _ = login(staff=True, name='admin-user')
    assert client.put(URL, {'revision': 0, 'rows': [row('관리자 입력', 'NA')]}, format='json').status_code == 200
    assert client.put(URL, {'revision': 0, 'rows': []}, format='json').status_code == 409


@pytest.mark.django_db
def test_account_api_sets_group_lead_countries():
    client, _ = login(staff=True, name='admin-user')
    response = client.post('/api/db-admin/accounts/', {'name': '그룹장', 'username': 'gl@example.com', 'password': 'StrongExample!93427',
                                                       'role': 'group_lead', 'managed_countries': ['EU', 'NA']}, format='json')
    assert response.status_code == 201, response.data
    assert response.data['role'] == 'group_lead' and response.data['managed_countries'] == ['EU', 'NA']
    pk = response.data['id']
    assert client.patch(f'/api/db-admin/accounts/{pk}/', {'role': 'group_lead', 'managed_countries': []}, format='json').status_code == 400
    assert client.patch(f'/api/db-admin/accounts/{pk}/', {'role': 'team_lead'}, format='json').data['managed_countries'] == []
    member = APIClient()
    member.force_login(get_user_model().objects.get(pk=pk))
    assert member.get('/api/me/').data['staff_edit_countries'] == ['KR', 'EU', 'NA']
