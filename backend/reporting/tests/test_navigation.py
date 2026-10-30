import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from reporting.models import NavigationPreference

URL = '/api/navigation/preferences/'


@pytest.mark.django_db
def test_visitor_preferences_persist_in_db_and_are_private_to_browser():
    first = APIClient()
    response = first.get(URL)
    assert response.status_code == 200
    assert response.data == {'hidden_tabs': [], 'sidebar_collapsed': False}
    assert response.cookies['coc_navigation']['httponly']
    assert response['Cache-Control'] == 'private, no-store'
    response = first.patch(URL, {'hidden_tabs': ['staff', 'issues'], 'sidebar_collapsed': True}, format='json')
    assert response.status_code == 200, response.data
    assert NavigationPreference.objects.get().hidden_tabs == ['staff', 'issues']
    assert first.get(URL).data['sidebar_collapsed'] is True
    assert APIClient().get(URL).data == {'hidden_tabs': [], 'sidebar_collapsed': False}
    assert NavigationPreference.objects.count() == 2


@pytest.mark.django_db
def test_member_preferences_are_individual_and_do_not_require_admin():
    first_user = get_user_model().objects.create_user(username='first@example.com')
    second_user = get_user_model().objects.create_user(username='second@example.com')
    first = APIClient(); first.force_login(first_user)
    second = APIClient(); second.force_login(second_user)
    assert first.patch(URL, {'hidden_tabs': ['work', 'logs']}, format='json').status_code == 200
    assert second.get(URL).data['hidden_tabs'] == []
    assert first.get(URL).data['hidden_tabs'] == ['work', 'logs']
    assert NavigationPreference.objects.get(user=first_user).browser_key is None
    assert NavigationPreference.objects.get(user=second_user).hidden_tabs == []


@pytest.mark.django_db
@pytest.mark.parametrize('values', [
    {'hidden_tabs': ['home']}, {'hidden_tabs': ['database']}, {'hidden_tabs': ['missing']},
    {'hidden_tabs': 'staff'}, {'sidebar_collapsed': {'invalid': True}},
])
def test_invalid_preferences_and_required_navigation_cannot_be_hidden(values):
    client = APIClient(); client.get(URL)
    assert client.patch(URL, values, format='json').status_code == 400
    assert client.get(URL).data == {'hidden_tabs': [], 'sidebar_collapsed': False}


@pytest.mark.django_db
def test_show_all_tabs_restores_navigation():
    client = APIClient(); client.get(URL)
    assert client.patch(URL, {'hidden_tabs': ['staff', 'staff', 'work']}, format='json').data['hidden_tabs'] == ['staff', 'work']
    assert client.patch(URL, {'hidden_tabs': []}, format='json').status_code == 200
    assert client.get(URL).data['hidden_tabs'] == []


@pytest.mark.django_db
def test_visitor_preferences_adopted_on_first_login_then_user_settings_remain():
    client = APIClient(); client.get(URL)
    assert client.patch(URL, {'hidden_tabs': ['staff']}, format='json').status_code == 200
    user = get_user_model().objects.create_user(username='member@example.com')
    client.force_login(user)
    assert client.get(URL).data['hidden_tabs'] == ['staff']
    other_browser = APIClient(); other_browser.force_login(user)
    assert other_browser.get(URL).data['hidden_tabs'] == ['staff']


@pytest.mark.django_db
def test_layout_preference_patch_requires_csrf_even_for_visitors():
    client = APIClient(enforce_csrf_checks=True)
    assert client.patch(URL, {'hidden_tabs': ['staff']}, format='json').status_code == 403
    client.get(URL)
    response = client.patch(URL, {'hidden_tabs': ['staff']}, format='json', HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
    assert response.status_code == 200, response.data
