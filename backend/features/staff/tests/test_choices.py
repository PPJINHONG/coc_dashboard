import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.roles import apply_role
from features.staff.models import StaffAssignment, StaffChoice
from reporting.models import ChangeLog, DataState, StaffMember

URL = '/api/operations/staff/choices/'


def client(role):
    user = get_user_model().objects.create_user(username=f'{role}@choices.test')
    apply_role(user, role, ['KR'] if role == 'group_lead' else [])
    api = APIClient()
    api.force_authenticate(user)
    return api


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


@pytest.mark.django_db
@pytest.mark.parametrize('role,can_manage', [('admin', True), ('team_lead', True), ('group_lead', False), ('user', False), ('observer', False)])
def test_choice_management_only_team_lead_and_above(role, can_manage):
    api = client(role)
    existing = StaffChoice.objects.create(kind='work_location', country_code='KR', value='서울')
    options = api.get('/api/operations/staff/options/').data
    assert options['can_manage_choices'] == can_manage and options['choices'][0]['value'] == '서울'
    response = api.post(URL, {'revision': revision(), 'choice': {'kind': 'work_location', 'country_code': 'NA', 'value': '미국 사무실'}}, format='json')
    assert response.status_code == (200 if can_manage else 403)
    response = api.delete(f'{URL}{existing.pk}/', {'revision': revision()}, format='json')
    assert response.status_code == (200 if can_manage else 403)


@pytest.mark.django_db
def test_options_empty_by_default_and_deleting_option_preserves_existing_people():
    api = client('team_lead')
    assert api.get(URL).data['choices'] == []
    response = api.post(URL, {'revision': 0, 'choice': {'kind': 'company_name', 'value': '운영 회사'}}, format='json')
    assert response.status_code == 200, response.data
    option = StaffChoice.objects.get()
    person = StaffAssignment.objects.create(staff=StaffMember.objects.create(staff_name='기존 인력'), company_name='운영 회사', country_code='KR')
    assert api.delete(f'{URL}{option.pk}/', {'revision': revision()}, format='json').status_code == 200
    person.refresh_from_db()
    assert person.company_name == '운영 회사'
    assert ChangeLog.objects.filter(section='staff').count() == 2


@pytest.mark.django_db
def test_choice_validation_revision_and_restoration():
    api = client('admin')
    for values in [{'kind': 'grade', 'value': 'L5'}, {'kind': 'work_location', 'country_code': 'JP', 'value': '사무실'}, {'kind': 'company_name', 'value': ' '}, {'kind': 'company_name', 'value': 'x' * 101}]:
        assert api.post(URL, {'revision': 0, 'choice': values}, format='json').status_code == 400
    values = {'kind': 'work_location', 'country_code': 'KR', 'value': '한국 사무실'}
    assert api.post(URL, {'revision': 0, 'choice': values}, format='json').status_code == 200
    assert api.post(URL, {'revision': 0, 'choice': values}, format='json').status_code == 409
    assert api.post(URL, {'revision': revision(), 'choice': values}, format='json').status_code == 400
    option = StaffChoice.objects.get()
    assert api.delete(f'{URL}{option.pk}/', {'revision': revision()}, format='json').status_code == 200
    log = ChangeLog.objects.first()
    preview = api.post(f'/api/db-admin/logs/{log.pk}/restore-preview/', {}, format='json')
    assert preview.status_code == 200
    response = api.post(f'/api/db-admin/logs/{log.pk}/restore/', {'token': preview.data['token'], 'confirmed': True}, format='json')
    assert response.status_code == 200, response.data
    assert StaffChoice.objects.get(pk=option.pk).value == '한국 사무실'
