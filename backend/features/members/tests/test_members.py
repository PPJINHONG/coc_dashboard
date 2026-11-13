import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import UserActivity
from core.roles import apply_role, user_role

URL = '/api/members/'


def person(name, role='user'):
    user = get_user_model().objects.create_user(username=f'{name}@example.com', first_name=name)
    apply_role(user, role, ['KR'] if role == 'group_lead' else [])
    return user


def client_for(user):
    client = APIClient()
    client.force_login(user)
    return client


@pytest.mark.django_db
@pytest.mark.parametrize('role', ['user', 'observer', 'group_lead'])
def test_only_admin_and_team_lead_can_access(role, settings):
    settings.DEVELOPMENT_AUTH_BYPASS = True
    client = client_for(person('member', role))
    assert client.get(URL).status_code == 403
    assert client.post(URL, {}, format='json').status_code == 403
    assert client.patch(URL + '1/', {}, format='json').status_code == 403
    assert APIClient().get(URL).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize('role,expected', [
    ('admin', {'team_lead', 'group_lead', 'user', 'observer'}),
    ('team_lead', {'group_lead', 'user', 'observer'}),
])
def test_list_exposes_permissions_without_secrets(role, expected):
    actor = person('actor', role)
    peer = person('peer', role)
    lower = person('lower')
    result = client_for(actor).get(URL)
    assert result.status_code == 200
    assert {item['value'] for item in result.data['assignable_roles']} == expected
    rows = {item['id']: item for item in result.data['accounts']}
    assert not rows[actor.pk]['can_edit'] and not rows[peer.pk]['can_edit']
    assert rows[lower.pk]['can_edit']
    assert all('password' not in item for item in rows.values())


@pytest.mark.django_db
def test_team_lead_can_update_lower_member_role_region_and_profile():
    actor = person('actor', 'team_lead')
    target = person('target')
    client = client_for(actor)
    result = client.patch(f'{URL}{target.pk}/', {'name': '이름 수정', 'role': 'group_lead', 'managed_countries': ['EU', 'NA']}, format='json')
    assert result.status_code == 200, result.data
    assert result.data['managed_countries'] == ['EU', 'NA'] and result.data['can_edit']
    target.refresh_from_db()
    assert target.first_name == '이름 수정' and user_role(target) == 'group_lead'
    log = UserActivity.objects.get(user=actor, action='update')
    assert log.changes['role'] == {'before': 'user', 'after': 'group_lead'}
    assert client.patch(f'{URL}{target.pk}/', {'role': 'observer'}, format='json').data['managed_countries'] == []
    assert client.get('/api/db-admin/accounts/').status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize('role,requested', [('admin', 'admin'), ('team_lead', 'admin'), ('team_lead', 'team_lead')])
def test_role_escalation_and_is_staff_bypass_are_rejected(role, requested):
    client = client_for(person('actor', role))
    target = person('target')
    for changes in [{'role': requested}, {'is_staff': True}, {'role': requested, 'is_staff': False}]:
        assert client.patch(f'{URL}{target.pk}/', changes, format='json').status_code == 400
    target.refresh_from_db()
    assert user_role(target) == 'user'
    assert client.post(URL, {'name': 'new', 'username': 'new@example.com', 'password': 'StrongExample!93427', 'role': requested}, format='json').status_code == 400


@pytest.mark.django_db
def test_team_lead_cannot_modify_self_peer_or_admin_even_without_role():
    actor = person('actor', 'team_lead')
    client = client_for(actor)
    for target in [actor, person('peer', 'team_lead'), person('admin', 'admin')]:
        assert client.patch(f'{URL}{target.pk}/', {'name': '변경', 'is_active': False}, format='json').status_code == 400
        target.refresh_from_db()
        assert target.is_active
    assert client.delete(f'{URL}{actor.pk}/').status_code == 405


@pytest.mark.django_db
def test_member_creation_deactivation_and_audit():
    client = client_for(person('actor', 'team_lead'))
    data = {'name': '신규 회원', 'username': 'new@example.com', 'password': 'StrongExample!93427', 'role': 'user'}
    result = client.post(URL, data, format='json')
    assert result.status_code == 201, result.data
    target = get_user_model().objects.get(pk=result.data['id'])
    assert target.check_password(data['password'])
    assert client.post(URL, data, format='json').status_code == 400
    assert client.patch(f'{URL}{target.pk}/', {'role': 'group_lead', 'managed_countries': []}, format='json').status_code == 400
    assert client.patch(f'{URL}{target.pk}/', {'is_active': False}, format='json').status_code == 200
    assert not APIClient().login(username=data['username'], password=data['password'])
    assert 'password' not in UserActivity.objects.filter(action='create').get().after_data


@pytest.mark.django_db
def test_inactive_manager_is_denied():
    actor = person('actor', 'team_lead')
    client = client_for(actor)
    actor.is_active = False
    actor.save()
    assert client.get(URL).status_code == 403


@pytest.mark.django_db
def test_legacy_admin_endpoint_cannot_bypass_hierarchy():
    actor = person('actor', 'admin')
    peer = person('peer', 'admin')
    client = client_for(actor)
    assert client.patch(f'/api/db-admin/accounts/{peer.pk}/', {'role': 'user'}, format='json').status_code == 400
    assert client.delete(f'/api/db-admin/accounts/{peer.pk}/', {'confirm_username': peer.username}, format='json').status_code == 400
