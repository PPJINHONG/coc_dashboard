"""이력 권한 경계와 실제 데이터 복구의 원자성·충돌·확인 절차를 검증합니다."""
import json
from datetime import date
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core import signing
from rest_framework.test import APIClient

from core.models import UserActivity
from core.roles import apply_role
from core.signals import username_changed
from features.regional_requests.models import RegionalRequest, RegionalRequestImage
from features.resources.models import InfrastructureResource
from features.staff.models import StaffAssignment, StaffCalendarEvent
from reporting.models import ChangeLog, DataState, Region, Service, StaffMember
from reporting.months import current_month

URL = '/api/operations/logs/'
ADMIN = '/api/db-admin/'
MONTH = '2026-08'


@pytest.fixture
def setup(db, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.DEVELOPMENT_AUTH_BYPASS = False
    users = {}
    for role in ('admin', 'team_lead', 'group_lead', 'user', 'other', 'observer'):
        user = get_user_model().objects.create_user(username=f'{role}@history.test', first_name=role)
        apply_role(user, role if role != 'other' else 'user', ['KR'] if role == 'group_lead' else [])
        users[role] = user
    regions = {country: Region.objects.create(region_name=f'{country} 리전', country_code=country) for country in ('KR', 'EU', 'NA')}
    Service.objects.create(service_code='TEST', service_name='테스트')
    return users, regions


def client(user):
    value = APIClient()
    value.force_authenticate(user)
    return value


def revision():
    return DataState.objects.get_or_create(pk=1)[0].revision


def save_resources(user, rows, month=MONTH):
    response = client(user).put(ADMIN + 'sections/resources/', {'revision': revision(), 'month': month, 'rows': rows}, format='json')
    assert response.status_code == 200, response.data
    return response.data['rows']


def resource(region, count=1):
    return {'region': region.pk, 'service': 'TEST', 'host_count': count}


def preview(user, log):
    return client(user).post(ADMIN + f'logs/{log.pk}/restore-preview/', {}, format='json')


def restore(user, log, token):
    return client(user).post(ADMIN + f'logs/{log.pk}/restore/', {'token': token, 'confirmed': True}, format='json')


def create_request(user, **values):
    body = {'region': 'KR', 'title': '원래 요청', 'content_html': '<p>요청 내용</p>', 'requester': '운영팀',
            'schedule_timezone': 'KST', 'schedule_start_local': '2026-11-20T10:00',
            'schedule_end_local': '2026-11-20T11:00', 'assignee_regions': ['KR'], 'assignee_name': '담당자', **values}
    response = client(user).post('/api/operations/regional_requests/', body, format='json')
    assert response.status_code == 201, response.data
    return response.data['row']


def test_scope_redacts_other_countries_from_batch_and_snapshot(setup):
    users, regions = setup
    save_resources(users['admin'], [resource(regions['KR'], 3), resource(regions['EU'], 777)])
    log = ChangeLog.objects.get()
    for role in ('admin', 'team_lead', 'group_lead', 'user', 'observer'):
        response = client(users[role]).get(URL)
        assert response.status_code == 200
        data = response.data
        snapshot = client(users[role]).get('/api/operations/current/').data['logs']
        if role in ('user', 'observer'):
            assert data['count'] == 0 and snapshot == []
        else:
            assert data['count'] == 1 and len(snapshot) == 1
            row = data['results'][0]
            assert row['can_restore'] == (role == 'admin')
            assert len(row['after_data']['rows']) == (1 if role == 'group_lead' else 2)
            if role == 'group_lead':
                assert row['after_data']['rows'][0]['host_count'] == 3
                assert {item['id'] for item in data['regions']} == {regions['KR'].pk}
                assert snapshot[0]['after_data'] == row['after_data']
                forbidden = client(users[role]).get(URL, {'region': regions['EU'].pk, 'actor': data['actors'][0]['id']}).data
                assert forbidden['count'] == 0
    assert log.restore_data['changes']


def test_user_only_own_and_author_usernames_never_exposed(setup):
    users, regions = setup
    for role in ('user', 'other'):
        create_request(users[role], title=role)
    body = client(users['user']).get(URL).data
    assert body['count'] == 1 and body['results'][0]['actor_name'] == 'user'
    assert 'author_username' not in json.dumps(body, default=str) and 'actor_username' not in json.dumps(body, default=str)
    assert body['results'][0]['can_restore'] is False
    users['user'].username = 'renamed@history.test'
    users['user'].save()
    username_changed.send(sender=get_user_model(), old_username='user@history.test', new_username=users['user'].username)
    assert client(users['user']).get(URL).data['count'] == 1


def test_latest_tab_order_filters_and_pagination(setup):
    users, regions = setup
    for index in range(35):
        create_request(users['user'], title=str(index))
    save_resources(users['admin'], [resource(regions['EU'])], month='2026-09')
    response = client(users['team_lead']).get(URL).data
    assert response['count'] == 36 and len(response['results']) == 30 and response['next_offset'] == 30
    assert [tab['id'] for tab in response['tabs']] == ['resources', 'regional_requests']
    assert [row['id'] for row in response['results']] == sorted([row['id'] for row in response['results']], reverse=True)
    older = client(users['team_lead']).get(URL, {'offset': 30}).data
    assert len(older['results']) == 6 and older['next_offset'] is None
    assert not {row['id'] for row in older['results']}.intersection(row['id'] for row in response['results'])
    user_key = next(actor['id'] for actor in response['actors'] if actor['name'] == 'user')
    filtered = client(users['team_lead']).get(URL, {'section': 'regional_requests', 'month': current_month().strftime('%Y-%m'), 'actor': user_key, 'region': 'KR'}).data
    assert filtered['count'] == 35
    assert client(users['team_lead']).get(URL, {'month': 'bad'}).status_code == 400
    assert client(users['team_lead']).get(URL, {'offset': 'bad'}).status_code == 400


def test_restore_reverts_only_affected_rows_preserves_other_month_and_audits(setup):
    users, regions = setup
    rows = save_resources(users['admin'], [resource(regions['KR'], 1), resource(regions['EU'], 2)])
    rows[0]['host_count'] = 10
    save_resources(users['admin'], rows)
    log = ChangeLog.objects.first()
    assert len(log.restore_data['changes']) == 1
    save_resources(users['admin'], [resource(regions['NA'], 50)], month='2026-09')
    approved = preview(users['admin'], log)
    assert approved.status_code == 200 and approved.data['affected_count'] == 1
    result = restore(users['admin'], log, approved.data['token'])
    assert result.status_code == 200, result.data
    assert InfrastructureResource.objects.get(region=regions['KR']).host_count == 1
    assert InfrastructureResource.objects.get(region=regions['EU']).host_count == 2
    assert InfrastructureResource.objects.get(region=regions['NA']).host_count == 50
    assert ChangeLog.objects.get(restored_from=log).action == 'restore'
    assert UserActivity.objects.filter(action='restore', target_id=str(log.pk)).exists()
    assert preview(users['admin'], log).status_code == 409
    restored_log = ChangeLog.objects.get(restored_from=log)
    assert preview(users['admin'], restored_log).status_code == 409
    public = next(item for item in client(users['admin']).get(URL).data['results'] if item['id'] == log.pk)
    assert public['restored'] and not public['can_restore']


def test_later_changes_to_other_rows_are_preserved(setup):
    users, regions = setup
    rows = save_resources(users['admin'], [resource(regions['KR']), resource(regions['EU'])])
    rows[0]['host_count'] = 5
    rows = save_resources(users['admin'], rows)
    log = ChangeLog.objects.first()
    rows[1]['host_count'] = 9
    save_resources(users['admin'], rows)
    approved = preview(users['admin'], log)
    result = restore(users['admin'], log, approved.data['token'])
    assert result.status_code == 200, result.data
    assert InfrastructureResource.objects.get(region=regions['EU']).host_count == 9


def test_later_same_row_changes_block_restore_and_stale_confirmation(setup):
    users, regions = setup
    rows = save_resources(users['admin'], [resource(regions['KR'])])
    log = ChangeLog.objects.first()
    approved = preview(users['admin'], log)
    rows[0]['host_count'] = 99
    save_resources(users['admin'], rows)
    assert preview(users['admin'], log).status_code == 409
    assert restore(users['admin'], log, approved.data['token']).status_code == 409
    assert InfrastructureResource.objects.get().host_count == 99
    assert not ChangeLog.objects.filter(restored_from=log).exists()


@pytest.mark.parametrize('action', ['create', 'update', 'delete'])
def test_restore_request_actions_preserves_author_month_and_content(setup, action):
    users, regions = setup
    row = create_request(users['user'])
    ticket = RegionalRequest.objects.get(pk=row['id'])
    requested_at = ticket.requested_at
    if action == 'update':
        response = client(users['user']).patch(f'/api/operations/regional_requests/{ticket.pk}/', {'title': '수정한 요청', 'status': 'in_progress'}, format='json')
        assert response.status_code == 200, response.data
    elif action == 'delete':
        response = client(users['admin']).delete(f'/api/operations/regional_requests/{ticket.pk}/')
        assert response.status_code == 200, response.data
    log = ChangeLog.objects.first()
    approved = preview(users['admin'], log)
    assert approved.status_code == 200, approved.data
    result = restore(users['admin'], log, approved.data['token'])
    assert result.status_code == 200, result.data
    if action == 'create':
        assert not RegionalRequest.objects.exists()
    else:
        restored = RegionalRequest.objects.get(pk=ticket.pk)
        assert restored.title == '원래 요청' and restored.status == 'open'
        assert restored.author_id == users['user'].pk and restored.author_username == users['user'].username
        assert restored.requested_at == requested_at and restored.period_month == current_month()


def test_restore_staff_name_and_assignment_and_group_scope(setup):
    users, regions = setup
    member = StaffMember.objects.create(staff_name='원래 이름')
    person = StaffAssignment.objects.create(staff=member, country_code='KR', job_title='책임')
    response = client(users['team_lead']).patch('/api/operations/staff/', {'revision': revision(), 'person': {'id': person.pk, 'staff_name': '새 이름', 'country_code': 'KR', 'job_title': '그룹장'}}, format='json')
    assert response.status_code == 200, response.data
    log = ChangeLog.objects.first()
    scoped = client(users['group_lead']).get(URL).data
    assert scoped['count'] == 1 and len(scoped['results'][0]['after_data']['rows']) == 2
    approved = preview(users['admin'], log)
    result = restore(users['admin'], log, approved.data['token'])
    assert result.status_code == 200, result.data
    assert StaffMember.objects.get(pk=member.pk).staff_name == '원래 이름'
    assert StaffAssignment.objects.get(pk=person.pk).job_title == '책임'


def test_linked_data_conflict_rolls_back_all_rows(setup):
    users, regions = setup
    member = StaffMember.objects.create(staff_name='보존할 인력')
    response = client(users['admin']).post('/api/operations/staff/', {'revision': revision(), 'person': {'staff_name': '신규 인력', 'country_code': 'KR'}}, format='json')
    assert response.status_code == 201
    log = ChangeLog.objects.first()
    new_member = StaffMember.objects.exclude(pk=member.pk).get()
    StaffCalendarEvent.objects.create(assignment=StaffAssignment.objects.get(staff=new_member), country_code='KR', kind='leave', start_date=date(2026, 11, 1), end_date=date(2026, 11, 2))
    approved = preview(users['admin'], log)
    before_revision = revision()
    result = restore(users['admin'], log, approved.data['token'])
    assert result.status_code == 409
    assert StaffAssignment.objects.filter(staff=new_member).exists() and StaffMember.objects.filter(pk=new_member.pk).exists()
    assert revision() == before_revision and not ChangeLog.objects.filter(restored_from=log).exists()


@pytest.mark.parametrize('role', ['user', 'observer', 'group_lead', 'team_lead'])
def test_only_admin_can_preview_or_execute_even_with_forged_token(setup, role):
    users, regions = setup
    save_resources(users['admin'], [resource(regions['KR'])])
    log = ChangeLog.objects.first()
    approved = preview(users['admin'], log)
    assert preview(users[role], log).status_code == 403
    assert restore(users[role], log, approved.data['token']).status_code == 403
    assert InfrastructureResource.objects.count() == 1


def test_confirmation_token_user_expiration_and_csrf(setup):
    users, regions = setup
    save_resources(users['admin'], [resource(regions['KR'])])
    log = ChangeLog.objects.first()
    token = preview(users['admin'], log).data['token']
    path = ADMIN + f'logs/{log.pk}/restore/'
    assert client(users['admin']).post(path, {'token': token}, format='json').status_code == 400
    assert restore(users['admin'], log, token + 'tamper').status_code == 400
    another_admin = get_user_model().objects.create_user(username='second@history.test', is_staff=True)
    assert restore(another_admin, log, token).status_code == 400
    import time
    with patch('django.core.signing.time.time', return_value=time.time() + 301):
        assert restore(users['admin'], log, token).status_code == 400
    csrf = APIClient(enforce_csrf_checks=True)
    csrf.force_login(users['admin'])
    assert csrf.post(path, {'token': token, 'confirmed': True}, format='json').status_code == 403
    users['admin'].is_active = False
    users['admin'].save()
    assert preview(users['admin'], log).status_code == 403


def test_legacy_history_readable_but_not_restorable(setup):
    users, regions = setup
    old = ChangeLog.objects.create(section='resources', action='update', actor_name='과거 관리자', before_data={'rows': []}, after_data={'rows': [resource(regions['KR'])]})
    response = client(users['group_lead']).get(URL).data
    assert response['count'] == 1 and not response['results'][0]['can_restore']
    assert preview(users['admin'], old).status_code == 400
    assert APIClient().get(URL).status_code == 403


def test_request_country_scope_filters_and_bulk_write_remains_unavailable(setup):
    users, _ = setup
    create_request(users['user'], region='KR', title='한국 요청')
    create_request(users['other'], region='EU', title='유럽 요청')
    response = client(users['group_lead']).get(URL).data
    assert response['count'] == 1
    assert response['results'][0]['after_data']['rows'][0]['title'] == '한국 요청'
    assert [region['id'] for region in response['regions']] == ['KR']
    assert client(users['group_lead']).get(URL, {'region': 'EU'}).data['results'] == []
    filtered = client(users['team_lead']).get(URL, {'region': 'EU', 'section': 'regional_requests'}).data
    assert filtered['count'] == 1 and filtered['results'][0]['after_data']['rows'][0]['title'] == '유럽 요청'
    assert client(users['admin']).put(ADMIN + 'sections/regional_requests/', {'revision': revision(), 'rows': []}, format='json').status_code == 400
    assert RegionalRequest.objects.count() == 2


def test_main_request_author_assignment_and_observer_permissions_are_preserved(setup):
    users, _ = setup
    row = create_request(users['user'])
    path = f"/api/operations/regional_requests/{row['id']}/"
    assert client(users['other']).patch(path, {'title': '가로채기'}, format='json').status_code == 403
    assert client(users['other']).patch(path, {'status': 'in_progress', 'assignee_regions': ['EU'], 'assignee_name': '다른 담당자'}, format='json').status_code == 200
    assert client(users['other']).delete(path).status_code == 403
    assert client(users['user']).delete(path).status_code == 403
    assert client(users['observer']).patch(path, {'status': 'completed'}, format='json').status_code == 403
    ticket = RegionalRequest.objects.get(pk=row['id'])
    assert ticket.title == '원래 요청' and ticket.assignee_regions == ['EU'] and ticket.status == 'in_progress'
    assert client(users['other']).get(URL).data['count'] == 1


def uploaded_image(user):
    from io import BytesIO
    from PIL import Image
    from django.core.files.uploadedfile import SimpleUploadedFile
    stream = BytesIO()
    Image.new('RGB', (2, 2), 'blue').save(stream, format='PNG')
    content = stream.getvalue()
    response = client(user).post('/api/operations/regional_requests/images/',
                                 {'file': SimpleUploadedFile('sample.png', content, content_type='image/png')}, format='multipart')
    assert response.status_code == 201, response.data
    return response.data, content


@pytest.mark.parametrize('action', ['delete_request', 'remove_image'])
def test_restore_includes_image_bytes_after_main_delete_signal(setup, action, django_capture_on_commit_callbacks):
    users, _ = setup
    image, content = uploaded_image(users['user'])
    row = create_request(users['user'], content_html=f'<p>본문</p><img src="{image["url"]}">')
    original = RegionalRequestImage.objects.get(pk=image['id'])
    name, created_at = original.file.name, original.created_at
    storage = original.file.storage
    with django_capture_on_commit_callbacks(execute=True):
        path = f"/api/operations/regional_requests/{row['id']}/"
        result = (client(users['admin']).delete(path) if action == 'delete_request' else
                  client(users['user']).patch(path, {'content_html': '<p>이미지 제거</p>'}, format='json'))
        assert result.status_code == 200, result.data
    assert not storage.exists(name) and not RegionalRequestImage.objects.filter(pk=image['id']).exists()
    log = ChangeLog.objects.first()
    assert log.restore_data['files'] and storage.exists(log.restore_data['files'][0]['backup'])
    approved = preview(users['admin'], log)
    assert approved.status_code == 200, approved.data
    result = restore(users['admin'], log, approved.data['token'])
    assert result.status_code == 200, result.data
    restored_image = RegionalRequestImage.objects.get(pk=image['id'])
    assert restored_image.request_id == row['id'] and restored_image.created_at == created_at
    with restored_image.file.open('rb') as source:
        assert source.read() == content
    assert str(image['id']) in RegionalRequest.objects.get(pk=row['id']).content_html


def test_restoring_request_creation_releases_uploaded_image_instead_of_cascading(setup, django_capture_on_commit_callbacks):
    users, _ = setup
    image, content = uploaded_image(users['user'])
    create_request(users['user'], content_html=f'<p>본문</p><img src="{image["url"]}">')
    log = ChangeLog.objects.first()
    approved = preview(users['admin'], log)
    with django_capture_on_commit_callbacks(execute=True):
        result = restore(users['admin'], log, approved.data['token'])
        assert result.status_code == 200, result.data
    assert not RegionalRequest.objects.exists()
    preserved = RegionalRequestImage.objects.get(pk=image['id'])
    assert preserved.request_id is None
    with preserved.file.open('rb') as source:
        assert source.read() == content


def test_missing_image_backup_blocks_restore_without_partial_rows(setup, django_capture_on_commit_callbacks):
    users, _ = setup
    image, _ = uploaded_image(users['user'])
    row = create_request(users['user'], content_html=f'<p>본문</p><img src="{image["url"]}">')
    with django_capture_on_commit_callbacks(execute=True):
        assert client(users['admin']).delete(f"/api/operations/regional_requests/{row['id']}/").status_code == 200
    log = ChangeLog.objects.first()
    storage = RegionalRequestImage._meta.get_field('file').storage
    storage.delete(log.restore_data['files'][0]['backup'])
    assert preview(users['admin'], log).status_code == 409
    assert not RegionalRequest.objects.exists() and not RegionalRequestImage.objects.exists()


def test_removed_issue_history_is_not_shown_or_restored(setup):
    users, _ = setup
    old = ChangeLog.objects.create(section='issues', action='delete', actor_name='과거 작성자',
                                   before_data={'id': 1, 'title': '기존 이슈'}, restore_data={'changes': [{'model': 'issues.regionalissue', 'pk': '1', 'before': {}, 'after': None}]})
    assert client(users['admin']).get(URL).data['results'] == []
    assert preview(users['admin'], old).status_code == 400
