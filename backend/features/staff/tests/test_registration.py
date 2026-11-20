from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import UserActivity
from invites.models import Invite, hash_token
from reporting.models import ChangeLog
from features.staff.models import StaffAssignment

TOKEN = 'staff-registration-invite-token'


@pytest.fixture
def invite(db):
    return Invite.objects.create(token_hash=hash_token(TOKEN), token_hint=TOKEN[-4:],
                                 expires_at=timezone.now() + timedelta(days=1), max_uses=None)


def signup(**extra):
    data = {'name': '김가입', 'username': 'join@example.com', 'password': 'Updated!93827', 'invite': TOKEN, **extra}
    return APIClient().post('/api/auth/register/', data, format='json')


def test_signup_registers_linked_staff_in_chosen_country(invite):
    response = signup(country_code='EU')
    assert response.status_code == 201, response.data
    person = StaffAssignment.objects.select_related('staff', 'account').get()
    assert (person.country_code, person.staff.staff_name, person.account.username) == ('EU', '김가입', 'join@example.com')
    log = ChangeLog.objects.get(section='staff')
    assert (log.action, log.actor_username) == ('create', 'join@example.com')
    assert UserActivity.objects.filter(user=person.account, target_type='staff').exists()


@pytest.mark.parametrize('country', [None, 'JP'])
def test_signup_requires_valid_country(invite, country):
    response = signup(**({'country_code': country} if country else {}))
    assert response.status_code == 400
    assert 'country_code' in response.data
    assert not StaffAssignment.objects.exists()
