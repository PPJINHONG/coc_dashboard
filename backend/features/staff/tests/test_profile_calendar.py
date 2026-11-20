from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.roles import apply_role
from features.staff.models import StaffAssignment, StaffCalendarEvent
from reporting.models import ChangeLog, DataState, StaffMember

ROOT = '/api/operations/staff/'


def profile(name, country='KR', role='user', **values):
    user = get_user_model().objects.create_user(username=f'{name}@example.com', first_name=name)
    apply_role(user, role, [country] if role == 'group_lead' else [])
    person = StaffAssignment.objects.create(account=user, staff=StaffMember.objects.create(staff_name=name), country_code=country, **values)
    return user, person


def login(user):
    client = APIClient()
    client.force_login(user)
    return client


def revision():
    state = DataState.objects.first()
    return state.revision if state else 0


def event(start='2026-11-10', end='2026-11-12', **values):
    return {'kind': 'leave', 'start_date': start, 'end_date': end, **values}


def create_event(client, **values):
    return client.post(ROOT + 'calendar/', {'revision': revision(), 'event': event(**values)}, format='json')


@pytest.fixture(autouse=True)
def today(monkeypatch):
    monkeypatch.setattr('features.staff.serializers.local_today', lambda country: date(2026, 11, 13))
    monkeypatch.setattr('features.staff.calendar_views.local_today', lambda country: date(2026, 11, 13))


@pytest.mark.django_db
@pytest.mark.parametrize('role,visible', [('admin', True), ('team_lead', True), ('group_lead', False), ('user', False), ('observer', False)])
def test_grade_visibility_depends_on_role_not_grade(role, visible):
    user, person = profile('actor', role=role, grade='L1')
    _, other = profile('other', 'EU', grade='L4')
    client = login(user)
    listed = client.get('/api/operations/current/').data['staff']
    assert all(('grade' in row) == visible for row in listed)
    assert client.get(ROOT + 'options/').data['can_view_grade'] == visible


@pytest.mark.django_db
def test_self_can_edit_profile_but_not_grade_dates_region_or_account():
    user, person = profile('actor')
    client = login(user)
    response = client.patch(ROOT, {'revision': 0, 'person': {'id': person.pk, 'staff_name': '이름 수정', 'pc_ip': '10.0.0.9'}}, format='json')
    assert response.status_code == 200, response.data
    person.refresh_from_db()
    assert person.staff.staff_name == '이름 수정' and person.pc_ip == '10.0.0.9'
    user.refresh_from_db()
    assert user.first_name == '이름 수정'
    for values in [{'grade': 'L4'}, {'deployment_date': '2026-01-01'}, {'resignation_date': '2026-11-12'}, {'country_code': 'NA'}, {'account': None}, {'job_title': '팀장'}]:
        assert client.patch(ROOT, {'revision': revision(), 'person': {'id': person.pk, **values}}, format='json').status_code == 403
    _, other = profile('other')
    assert client.patch(ROOT, {'revision': revision(), 'person': {'id': other.pk, 'pc_ip': 'x'}}, format='json').status_code == 403


@pytest.mark.django_db
def test_group_lead_manages_dates_only_in_scope_and_cannot_set_grade_or_link():
    user, _ = profile('lead', role='group_lead')
    _, person = profile('person')
    _, outside = profile('outside', country='EU')
    client = login(user)
    result = client.patch(ROOT, {'revision': 0, 'person': {'id': person.pk, 'deployment_date': '2026-01-01', 'resignation_date': '2026-11-12'}}, format='json')
    assert result.status_code == 200, result.data
    assert result.data['person']['employment_status'] == 'retired'
    for values in [{'grade': 'L2'}, {'account': None}]:
        assert client.patch(ROOT, {'revision': revision(), 'person': {'id': person.pk, **values}}, format='json').status_code == 403
    assert client.patch(ROOT, {'revision': revision(), 'person': {'id': outside.pk, 'deployment_date': '2026-01-01'}}, format='json').status_code == 403


@pytest.mark.django_db
def test_dates_grade_and_account_uniqueness_are_validated():
    user, _ = profile('admin', role='admin')
    target_user, person = profile('person')
    _, other = profile('other')
    client = login(user)
    for values in [{'grade': 'L5'}, {'deployment_date': '2026-12-01', 'resignation_date': '2026-11-01'}, {'account': target_user.pk}]:
        target = other if 'account' in values else person
        assert client.patch(ROOT, {'revision': 0, 'person': {'id': target.pk, **values}}, format='json').status_code == 400
    assert client.patch(ROOT, {'revision': 0, 'person': {'id': person.pk, 'grade': 'L4'}}, format='json').status_code == 200


@pytest.mark.django_db
def test_grade_is_redacted_from_current_and_change_history_for_group_lead():
    admin, _ = profile('admin', role='admin')
    group, _ = profile('group', role='group_lead')
    _, person = profile('person', grade='L1')
    client = login(admin)
    assert client.patch(ROOT, {'revision': 0, 'person': {'id': person.pk, 'grade': 'L4'}}, format='json').status_code == 200
    group_client = login(group)
    for url in ['/api/operations/current/', '/api/operations/logs/?section=staff']:
        data = group_client.get(url).data
        assert "'grade':" not in repr(data) and 'L4' not in repr(data)
    data = client.get('/api/operations/logs/?section=staff').data
    assert 'L4' in repr(data)


@pytest.mark.django_db
def test_calendar_is_combined_and_country_filtered_with_immediate_status():
    kr_user, kr = profile('kr')
    eu_user, eu = profile('eu', 'EU')
    kr_client, eu_client = login(kr_user), login(eu_user)
    result = create_event(kr_client, end='2026-11-14', assignment=eu.pk, country_code='EU')
    assert result.status_code == 201, result.data
    assert result.data['event']['assignment'] == kr.pk and result.data['event']['country_code'] == 'KR'
    assert create_event(eu_client, start='2026-10-30', end='2026-11-03', kind='marriage_leave').status_code == 201
    combined = kr_client.get(ROOT + 'calendar/?month=2026-11').data['events']
    assert {item['country_code'] for item in combined} == {'KR', 'EU'}
    assert [item['country_code'] for item in kr_client.get(ROOT + 'calendar/?month=2026-11&country=EU').data['events']] == ['EU']
    row = next(item for item in kr_client.get('/api/operations/current/').data['staff'] if item['id'] == kr.pk)
    assert row['current_status'] == '연차'
    assert len(ChangeLog.objects.filter(section='staff')) == 2


@pytest.mark.django_db
def test_only_owner_can_edit_or_delete_calendar_even_for_managers():
    owner, _ = profile('owner')
    client = login(owner)
    response = create_event(client)
    pk = response.data['event']['id']
    for role in ['user', 'group_lead', 'team_lead', 'admin', 'observer']:
        other, _ = profile(role, role=role)
        other_client = login(other)
        assert other_client.patch(f'{ROOT}calendar/{pk}/', {'revision': revision(), 'event': {'title': '다른 사람 수정'}}, format='json').status_code == 403
        assert other_client.delete(f'{ROOT}calendar/{pk}/', {'revision': revision()}, format='json').status_code == 403
    assert client.patch(f'{ROOT}calendar/{pk}/', {'revision': revision(), 'event': {'title': '본인 수정'}}, format='json').status_code == 200
    assert client.delete(f'{ROOT}calendar/{pk}/', {'revision': revision()}, format='json').status_code == 200
    assert not StaffCalendarEvent.objects.exists()


@pytest.mark.django_db
def test_calendar_rejects_unlinked_observer_overlap_and_invalid_dates():
    user, person = profile('owner', deployment_date=date(2026, 1, 1), resignation_date=date(2026, 12, 31))
    client = login(user)
    assert create_event(client, start='2026-11-14', end='2026-11-13').status_code == 400
    assert create_event(client, start='2025-12-31', end='2026-01-01').status_code == 400
    assert create_event(client, start='2026-12-31', end='2027-01-01').status_code == 400
    assert create_event(client).status_code == 201
    assert create_event(client).status_code == 400
    assert client.post(ROOT + 'calendar/', {'revision': 0, 'event': event()}, format='json').status_code == 409
    observer, _ = profile('observer', role='observer')
    assert create_event(login(observer)).status_code == 403
    unlinked = get_user_model().objects.create_user(username='unlinked@example.com')
    assert create_event(login(unlinked)).status_code == 403
    assert APIClient().get(ROOT + 'calendar/').status_code == 403


@pytest.mark.django_db
def test_responsibilities_follow_country_permission_and_show_names():
    group, kr = profile('group', role='group_lead')
    _, eu = profile('eu', 'EU')
    client = login(group)
    def save(values):
        return client.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': values}, format='json')
    assert save({'country_code': 'EU', 'group_lead': eu.pk}).status_code == 403
    assert save({'country_code': 'KR', 'group_lead': eu.pk}).status_code == 400
    # 현장대리인은 관리자만 지정합니다(관리 권역의 그룹장도 403).
    assert save({'country_code': 'KR', 'site_representative': kr.pk}).status_code == 403
    assert save({'country_code': 'KR', 'group_lead': kr.pk}).status_code == 200
    listed = client.get(ROOT + 'options/').data['responsibilities']
    assert listed[0]['group_lead_name'] == 'group'
    admin, _ = profile('admin', role='admin')
    admin_client = login(admin)
    assert admin_client.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'KR', 'site_representative': eu.pk}}, format='json').status_code == 400
    assert admin_client.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'KR', 'site_representative': kr.pk}}, format='json').status_code == 200


@pytest.mark.django_db
def test_trend_uses_deployment_and_company_resignation_and_excludes_unknown_dates():
    user, _ = profile('viewer')
    profile('joined', deployment_date=date(2026, 10, 1), company_name='메가존')
    profile('left', deployment_date=date(2026, 9, 1), resignation_date=date(2026, 10, 20), company_name='메가존')
    profile('outside', 'EU', deployment_date=date(2026, 10, 5))
    result = login(user).get(ROOT + 'trend/?month=2026-11&country=KR&company=메가존')
    assert result.status_code == 200, result.data
    october = next(item for item in result.data['months'] if item['month'] == '2026-10')
    assert october == {'month': '2026-10', 'entries': 1, 'exits': 1, 'headcount': 1, 'net': 0, 'recorded': False}
    assert result.data['missing_dates'] == 0
    assert result.data['companies'] == ['메가존']
    assert login(user).get(ROOT + 'trend/?month=2026-11').data['missing_dates'] == 1


@pytest.mark.django_db
def test_calendar_region_follows_current_profile_after_transfer():
    user, person = profile('owner')
    assert create_event(login(user)).status_code == 201
    admin, _ = profile('admin', role='admin')
    client = login(admin)
    assert client.patch(ROOT, {'revision': revision(), 'person': {'id': person.pk, 'country_code': 'EU'}}, format='json').status_code == 200
    assert not client.get(ROOT + 'calendar/?month=2026-11&country=KR').data['events']
    assert client.get(ROOT + 'calendar/?month=2026-11&country=EU').data['events'][0]['country_code'] == 'EU'


@pytest.mark.django_db
def test_explicit_account_link_syncs_names_and_member_updates_are_shared():
    admin, _ = profile('admin', role='admin')
    user = get_user_model().objects.create_user(username='linked@example.com', first_name='회원 이름')
    member = StaffMember.objects.create(staff_name='연결 전 이름')
    person = StaffAssignment.objects.create(staff=member, country_code='KR')
    client = login(admin)
    response = client.patch(ROOT, {'revision': 0, 'person': {'id': person.pk, 'account': user.pk}}, format='json')
    assert response.status_code == 200, response.data
    assert response.data['person']['staff_name'] == '회원 이름'
    response = client.patch(f'/api/members/{user.pk}/', {'name': '회원 이름 변경'}, format='json')
    assert response.status_code == 200
    person.staff.refresh_from_db()
    assert person.staff.staff_name == '회원 이름 변경'
    assert client.patch(f'/api/members/{user.pk}/', {'name': '가' * 101}, format='json').status_code == 400
    user.refresh_from_db()
    assert user.first_name == '회원 이름 변경'


@pytest.mark.django_db
@pytest.mark.parametrize('moment,values,with_event,hours,expected', [
    ('2026-11-13 10:00', {}, False, None, ('on_duty', '출근')),               # 금요일, 기본 09~18시
    ('2026-11-13 19:00', {}, False, None, ('off_duty', '퇴근')),
    ('2026-11-14 10:00', {}, False, None, ('off_duty', '퇴근')),              # 토요일
    ('2026-11-13 19:00', {}, False, ('17:00', '00:00'), ('on_duty', '출근')),  # EU처럼 자정에 끝나는 근무
    ('2026-11-13 16:00', {}, False, ('17:00', '00:00'), ('off_duty', '퇴근')),
    ('2026-11-13 08:00', {}, False, ('07:00', '16:00'), ('on_duty', '출근')),
    ('2026-11-13 10:00', {}, True, None, ('leave', '연차')),
    ('2026-11-13 10:00', {'deployment_date': date(2026, 12, 1)}, False, None, ('planned', '투입 예정')),
    ('2026-11-13 10:00', {'resignation_date': date(2026, 11, 12)}, False, None, ('retired', '퇴사')),
])
def test_work_status_uses_region_work_hours_and_local_time(monkeypatch, moment, values, with_event, hours, expected):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from features.staff.models import StaffResponsibility
    now = datetime.fromisoformat(moment).replace(tzinfo=ZoneInfo('Asia/Seoul'))
    monkeypatch.setattr('features.staff.serializers.local_today', lambda country: now.date())
    monkeypatch.setattr('features.staff.serializers.local_now', lambda country: now)
    user, person = profile('worker', **values)
    if hours:
        StaffResponsibility.objects.create(country_code='KR', work_start=hours[0], work_end=hours[1])
    if with_event:
        StaffCalendarEvent.objects.create(assignment=person, country_code='KR', kind='leave', start_date=now.date(), end_date=now.date())
    row = next(item for item in login(user).get('/api/operations/current/').data['staff'] if item['id'] == person.pk)
    assert (row['work_status'], row['current_status']) == expected
    assert row['status_detail']


@pytest.mark.django_db
def test_region_work_hours_are_validated_and_scoped_to_managed_country():
    group, _ = profile('group', role='group_lead')
    api = login(group)
    ok = api.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'KR', 'work_start': '08:30', 'work_end': '17:30'}}, format='json')
    assert ok.status_code == 200, ok.data
    assert (ok.data['responsibility']['work_start'], ok.data['responsibility']['work_end']) == ('08:30:00', '17:30:00')
    assert api.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'KR', 'work_start': '09:00', 'work_end': None}}, format='json').status_code == 400
    assert api.put(ROOT + 'responsibilities/', {'revision': revision(), 'responsibility': {'country_code': 'EU', 'work_start': '09:00', 'work_end': '18:00'}}, format='json').status_code == 403


@pytest.mark.django_db
def test_display_role_uses_assigned_team_and_group_leads():
    from features.staff.models import StaffResponsibility
    user, lead = profile('lead')
    _, group = profile('group')
    _, titled = profile('titled', job_title='팀장')
    StaffResponsibility.objects.create(country_code='KR', team_lead=lead, group_lead=group)
    StaffResponsibility.objects.create(country_code='EU', group_lead=titled)
    rows = {item['id']: item['display_role'] for item in login(user).get('/api/operations/current/').data['staff']}
    assert (rows[lead.pk], rows[group.pk], rows[titled.pk]) == ('team_lead', 'group_lead', 'team_lead')



@pytest.mark.django_db
def test_trend_uses_headcount_records_for_recorded_months_only():
    from features.staff.models import StaffHeadcountRecord
    user, _ = profile('viewer', deployment_date=date(2026, 11, 1))
    StaffHeadcountRecord.objects.create(period_month=date(2026, 10, 1), country_code='KR', headcount=8, entries=3)
    StaffHeadcountRecord.objects.create(period_month=date(2026, 10, 1), country_code='EU', headcount=7, entries=2)
    months = {item['month']: item for item in login(user).get(ROOT + 'trend/?month=2026-11').data['months']}
    assert (months['2026-10']['headcount'], months['2026-10']['entries'], months['2026-10']['recorded']) == (15, 5, True)
    assert (months['2026-11']['headcount'], months['2026-11']['recorded']) == (1, False)
    eu = {item['month']: item for item in login(user).get(ROOT + 'trend/?month=2026-11&country=EU').data['months']}
    assert eu['2026-10']['headcount'] == 7
