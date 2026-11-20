import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.roles import apply_role
from reporting.models import ChangeLog, DataState, StaffMember
from features.staff.models import StaffAssignment, StaffChoice, StaffColumn, StaffResponsibility

ROOT = '/api/operations/staff/'


def api(role='admin', name=None):
    user = get_user_model().objects.create_user(username=f'{name or role}@items.test', first_name=name or role)
    apply_role(user, role, ['KR'] if role == 'group_lead' else [])
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


def column(client, label='담당 시스템'):
    response = client.post(ROOT + 'columns/', {'revision': revision(), 'label': label}, format='json')
    assert response.status_code == 201, response.data
    return response.data['column']


def choice(client, kind, value, country=''):
    return client.post(ROOT + 'choices/', {'revision': revision(), 'choice': {'kind': kind, 'value': value, 'country_code': country}}, format='json')


def person(name='인력', country='KR', **values):
    return StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name=name), country_code=country, **values)


@pytest.mark.django_db
@pytest.mark.parametrize('role,allowed', [('admin', True), ('team_lead', True), ('group_lead', False), ('user', False), ('observer', False)])
def test_only_team_lead_and_admin_add_columns_and_grade_options(role, allowed):
    client, _ = api(role)
    response = client.post(ROOT + 'columns/', {'revision': revision(), 'label': '고객사'}, format='json')
    assert response.status_code == (201 if allowed else 403)
    assert choice(client, 'grade', 'L6').status_code == (200 if allowed else 403)
    result = client.get(ROOT + 'options/').data
    assert any(item['key'] == 'grade' for item in result['items']) == allowed
    assert any(item['kind'] == 'grade' for item in result['choices']) == allowed


@pytest.mark.django_db
def test_column_appears_in_items_values_save_reload_and_log_labels():
    client, _ = api()
    created = column(client)
    key = created['key']
    options = client.get(ROOT + 'options/').data
    descriptor = next(item for item in options['items'] if item['key'] == key)
    assert descriptor['label'] == '담당 시스템' and descriptor['values'] == [] and descriptor['custom']
    assert choice(client, key, '시스템 A').status_code == 200
    response = client.post(ROOT, {'revision': revision(), 'person': {'staff_name': '새 인력', 'country_code': 'KR', 'custom_values': {key: '시스템 A'}}}, format='json')
    assert response.status_code == 201, response.data
    pk = response.data['person']['id']
    assert client.get('/api/operations/current/').data['staff'][0]['custom_values'] == {key: '시스템 A'}
    assert StaffAssignment.objects.get(pk=pk).custom_values == {key: '시스템 A'}
    log = client.get('/api/operations/logs/').data['results'][0]
    assert log['column_labels'][key] == '담당 시스템'
    item = next(item for item in client.get(ROOT + 'options/').data['items'] if item['key'] == key)
    assert item['values'][0]['uses'] == 1


@pytest.mark.django_db
def test_custom_values_reject_unknown_free_text_and_preserve_used_deleted_choice():
    client, _ = api()
    key = column(client)['key']
    choice(client, key, '업무 A')
    row = person(custom_values={key: '업무 A'})
    for values in [{key: '미등록 값'}, {'unknown': '값'}, {key: ['배열']}, []]:
        assert client.patch(ROOT, {'revision': revision(), 'person': {'id': row.pk, 'custom_values': values}}, format='json').status_code == 400
    option = StaffChoice.objects.get(kind=key)
    assert client.delete(f'{ROOT}choices/{option.pk}/', {'revision': revision()}, format='json').status_code == 200
    row.refresh_from_db()
    assert row.custom_values[key] == '업무 A'
    assert client.patch(ROOT, {'revision': revision(), 'person': {'id': row.pk, 'job_description': '다른 항목 수정', 'custom_values': {key: '업무 A'}}}, format='json').status_code == 200
    descriptor = next(item for item in client.get(ROOT + 'options/').data['items'] if item['key'] == key)
    assert descriptor['values'] == [{'value': '업무 A', 'country_code': '', 'choice_id': None, 'uses': 1, 'default': False}]


@pytest.mark.django_db
def test_group_only_edits_custom_values_of_managed_people_and_owner_cannot_change():
    admin, _ = api()
    key = column(admin)['key']
    choice(admin, key, '운영')
    group, _ = api('group_lead')
    owner, owner_user = api('user')
    inside = person(account=owner_user)
    outside = person('유럽 인력', 'EU')
    assert group.patch(ROOT, {'revision': revision(), 'person': {'id': inside.pk, 'custom_values': {key: '운영'}}}, format='json').status_code == 200
    assert group.patch(ROOT, {'revision': revision(), 'person': {'id': outside.pk, 'custom_values': {key: '운영'}}}, format='json').status_code == 403
    assert owner.patch(ROOT, {'revision': revision(), 'person': {'id': inside.pk, 'custom_values': {key: '운영'}}}, format='json').status_code == 403


@pytest.mark.django_db
def test_grade_addition_is_selectable_but_remains_private():
    admin, _ = api()
    row = person()
    assert admin.patch(ROOT, {'revision': revision(), 'person': {'id': row.pk, 'grade': 'L6'}}, format='json').status_code == 400
    assert choice(admin, 'grade', 'L6').status_code == 200
    assert admin.patch(ROOT, {'revision': revision(), 'person': {'id': row.pk, 'grade': 'L6'}}, format='json').status_code == 200
    group, _ = api('group_lead')
    assert 'grade' not in group.get('/api/operations/current/').data['staff'][0]
    assert all(item['key'] != 'grade' for item in group.get(ROOT + 'options/').data['items'])
    assert all(item['kind'] != 'grade' for item in group.get(ROOT + 'choices/').data['choices'])
    option = StaffChoice.objects.get(kind='grade', value='L6')
    admin.delete(f'{ROOT}choices/{option.pk}/', {'revision': revision()}, format='json')
    assert admin.patch(ROOT, {'revision': revision(), 'person': {'id': row.pk, 'grade': 'L6', 'pc_ip': '예전 등급 보존'}}, format='json').status_code == 200


@pytest.mark.django_db
def test_column_validation_stale_revision_and_no_row_data_loss():
    client, _ = api()
    row = person(grade='L4', work_location='서울')
    for label in ['', ' ', '등급', '성명', '권역', 'a' * 81]:
        assert client.post(ROOT + 'columns/', {'revision': revision(), 'label': label}, format='json').status_code == 400
    column(client, '고객사')
    assert client.post(ROOT + 'columns/', {'revision': revision(), 'label': '  고객사  '}, format='json').status_code == 400
    assert client.post(ROOT + 'columns/', {'revision': 0, 'label': '다른 열'}, format='json').status_code == 409
    row.refresh_from_db()
    assert row.grade == 'L4' and row.work_location == '서울' and row.custom_values == {}


@pytest.mark.django_db
def test_site_representative_is_independent_and_updates_preserve_leaders():
    client, _ = api('admin')
    leader = person('그룹장', job_title='그룹장')
    representative = person('현장 대표', job_title='책임')
    StaffResponsibility.objects.create(country_code='KR', team_lead=leader, group_lead=leader)
    response = client.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'KR', 'site_representative': representative.pk}}, format='json')
    assert response.status_code == 200, response.data
    responsibility = StaffResponsibility.objects.get(country_code='KR')
    assert responsibility.team_lead_id == leader.pk and responsibility.group_lead_id == leader.pk
    listed = {item['id']: item for item in client.get('/api/operations/current/').data['staff']}
    assert listed[representative.pk]['is_site_representative'] and listed[representative.pk]['job_title'] == '책임'
    assert listed[representative.pk]['can_set_site_representative']
    assert not listed[leader.pk]['is_site_representative']
    assert client.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'KR', 'group_lead': representative.pk}}, format='json').status_code == 200
    assert StaffResponsibility.objects.get(country_code='KR').site_representative_id == representative.pk


@pytest.mark.django_db
@pytest.mark.parametrize('title,role,expected', [('팀장','user','team_lead'), ('그룹장','user','group_lead'), ('책임','user','user'), ('책임','observer','user')])
def test_row_tone_follows_role_and_does_not_change_edit_permission(title, role, expected):
    viewer, account = api(role)
    row = person(account=account, job_title=title)
    listed = viewer.get('/api/operations/current/').data['staff'][0]
    assert listed['display_role'] == expected
    assert listed['can_edit'] == (role != 'observer')
    assert listed['can_set_site_representative'] is False


@pytest.mark.django_db
def test_restore_custom_values_and_protect_used_column_from_restore_deletion():
    client, _ = api()
    key = column(client)['key']
    create_log = ChangeLog.objects.first()
    choice(client, key, '운영')
    row = person()
    assert client.patch(ROOT, {'revision': revision(), 'person': {'id': row.pk, 'custom_values': {key: '운영'}}}, format='json').status_code == 200
    change = ChangeLog.objects.first()
    approved = client.post(f'/api/db-admin/logs/{change.pk}/restore-preview/', {}, format='json')
    restored = client.post(f'/api/db-admin/logs/{change.pk}/restore/', {'token': approved.data['token'], 'confirmed': True}, format='json')
    assert restored.status_code == 200, restored.data
    row.refresh_from_db()
    assert row.custom_values == {}
    # 나중에 추가한 항목이 연결된 열은 복구로도 지우지 못합니다.
    approved = client.post(f'/api/db-admin/logs/{create_log.pk}/restore-preview/', {}, format='json')
    assert approved.status_code == 200
    blocked = client.post(f'/api/db-admin/logs/{create_log.pk}/restore/', {'token': approved.data['token'], 'confirmed': True}, format='json')
    assert blocked.status_code == 409 and StaffColumn.objects.filter(key=key).exists()


@pytest.mark.django_db
def test_restore_cannot_remove_column_with_saved_values_even_after_option_deleted():
    client, _ = api()
    key = column(client)['key']
    original = ChangeLog.objects.first()
    choice(client, key, '보존할 값')
    row = person(custom_values={key: '보존할 값'})
    option = StaffChoice.objects.get(kind=key)
    client.delete(f'{ROOT}choices/{option.pk}/', {'revision': revision()}, format='json')
    approved = client.post(f'/api/db-admin/logs/{original.pk}/restore-preview/', {}, format='json')
    assert approved.status_code == 200
    result = client.post(f'/api/db-admin/logs/{original.pk}/restore/', {'token': approved.data['token'], 'confirmed': True}, format='json')
    assert result.status_code == 409
    row.refresh_from_db()
    assert row.custom_values[key] == '보존할 값' and StaffColumn.objects.filter(key=key).exists()


@pytest.mark.django_db
def test_existing_staff_history_without_new_default_fields_can_still_restore():
    client, _ = api()
    response = client.post(ROOT, {'revision': revision(), 'person': {'staff_name': '이전 형식', 'country_code': 'KR'}}, format='json')
    assert response.status_code == 201
    original = ChangeLog.objects.first()
    for change in original.restore_data['changes']:
        for side in ('before', 'after'):
            if isinstance(change[side], dict):
                change[side].pop('custom_values', None)
    original.save(update_fields=['restore_data'])
    approved = client.post(f'/api/db-admin/logs/{original.pk}/restore-preview/', {}, format='json')
    assert approved.status_code == 200, approved.data
    result = client.post(f'/api/db-admin/logs/{original.pk}/restore/', {'token': approved.data['token'], 'confirmed': True}, format='json')
    assert result.status_code == 200, result.data
    assert not StaffAssignment.objects.exists()
