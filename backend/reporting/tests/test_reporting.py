import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from reporting.models import ChangeLog, DataState, InfrastructureResource, IssueComment, Region, RegionalIssue, Service, StaffAssignment, StaffMember, WorkSummary

ROOT = '/api/operations/'
ADMIN = '/api/db-admin/'


@pytest.fixture(autouse=True)
def development(settings):
    settings.DEVELOPMENT_AUTH_BYPASS = True


@pytest.fixture
def client(db):
    client = APIClient()
    client.force_login(get_user_model().objects.create_user(username='operator-admin@example.com', is_staff=True))
    return client


@pytest.fixture
def base(db):
    Region.objects.create(id=101, region_name='테스트 리전')
    Service.objects.create(service_code='TEST', service_name='테스트 서비스')


def resource(**values):
    return {'region': 101, 'service': 'TEST', 'environment_name': 'Core', 'host_count': 12, 'vm_count': None, **values}


def save(client, section, rows, revision=0):
    return client.put(ADMIN + f'sections/{section}/', {'revision': revision, 'rows': rows}, format='json')


@pytest.mark.django_db
def test_first_setup_is_empty_and_manual_reference_data_is_shared(client):
    bootstrap = client.get(ROOT + 'bootstrap/').data
    assert bootstrap['regions'] == [] and bootstrap['services'] == [] and bootstrap['staff_members'] == []
    assert 'weeks' not in bootstrap and 'current_week' not in bootstrap
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['resources'] == [] and snapshot['issues'] == []
    assert 'week' not in snapshot and 'kubernetes' not in snapshot
    client.force_login(get_user_model().objects.create_user(username='setup@example.com', is_staff=True))
    for collection, values in [('regions', {'region_name': '테스트 리전'}), ('services', {'service_code': 'TEST', 'service_name': '테스트 서비스'})]:
        assert client.post(ADMIN + f'common/{collection}/', values, format='json').status_code == 201
    assert Region.objects.get().region_name == '테스트 리전'
    assert save(client, 'resources', [resource(region=Region.objects.get().pk)], revision=2).status_code == 200
    assert InfrastructureResource.objects.get().host_count == 12
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['totals']['hosts'] == 12 and snapshot['totals']['missing_vm_rows'] == 1
    assert snapshot['revision'] == 3


@pytest.mark.django_db
def test_current_snapshot_has_no_week_or_kubernetes_tables(client):
    assert client.get(ROOT + 'current/').status_code == 200
    names = connection.introspection.table_names()
    assert not any('weekly' in name for name in names)
    assert 'report_weeks' not in names and 'k8s_weekly_clusters' not in names and 'test' not in names
    assert client.get('/api/reporting/bootstrap/').status_code == 404
    assert save(client, 'kubernetes', []).status_code == 400


@pytest.mark.django_db
def test_latest_values_and_revision_conflict(client, base):
    assert save(client, 'resources', [resource()]).status_code == 200
    row = client.get(ROOT + 'current/').data['resources'][0]
    assert row['updated_at']
    assert save(client, 'resources', [{**row, 'host_count': 30, 'updated_at': '2000-01-01T00:00:00Z'}], 1).status_code == 200
    assert InfrastructureResource.objects.get().updated_at.year > 2000
    assert save(client, 'resources', [{**row, 'host_count': 99}], 1).status_code == 409
    assert InfrastructureResource.objects.count() == 1
    assert client.get(ROOT + 'current/').data['totals']['hosts'] == 30


@pytest.mark.django_db
@pytest.mark.parametrize('rows', [[resource(host_count=-1)], [resource(), resource()], [resource(region='missing')]])
def test_invalid_resource_edits_are_atomic(client, base, rows):
    assert save(client, 'resources', rows).status_code == 400
    assert not InfrastructureResource.objects.exists()
    assert DataState.objects.count() == 0


@pytest.mark.django_db
def test_deleting_current_row_removes_it_from_database(client, base):
    assert save(client, 'resources', [resource()]).status_code == 200
    assert save(client, 'resources', [], 1).status_code == 200
    assert not InfrastructureResource.objects.exists()
    assert client.get(ROOT + 'current/').data['resources'] == []


@pytest.mark.django_db
def test_issue_comment_uses_same_persisted_data_without_period(client, base):
    assert save(client, 'issues', [{'region': 101, 'title': '운영 이슈', 'next_action': '점검'}]).status_code == 200
    issue = RegionalIssue.objects.get()
    response = client.post(ADMIN + f'issues/{issue.pk}/comments/', {'revision': 1, 'content': '진행 상황'}, format='json')
    assert response.status_code == 201, response.data
    assert IssueComment.objects.get().issue == issue
    snapshot = APIClient().get(ROOT + 'current/').data
    assert snapshot['issues'][0]['comments'][0]['content'] == '진행 상황'
    assert snapshot['revision'] == 2
    assert client.post(ADMIN + f'issues/{issue.pk}/comments/', {'revision': 1, 'content': '중복'}, format='json').status_code == 409


@pytest.mark.django_db
@pytest.mark.parametrize('values', [{'status': 'resolved', 'progress_percent': 50}, {'progress_percent': 101}])
def test_invalid_issue_progress_is_rejected(client, base, values):
    assert save(client, 'issues', [{'region': 101, 'title': '이슈', **values}]).status_code == 400
    assert not RegionalIssue.objects.exists()


@pytest.mark.django_db
def test_staff_and_work_persist_current_values(client, base):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, 'staff', [{'country_code': 'KR', 'staff': member.pk, 'job_title': '운영', 'company_name': '회사'}])
    assert response.status_code == 200, response.data
    response = save(client, 'work', [{'region': 101, 'work_type': 'incident', 'scope': 'automation', 'total_count': 5, 'completed_count': 3, 'mttr_minutes': '10.5'}], 1)
    assert response.status_code == 200, response.data
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['totals']['staff'] == 1 and snapshot['totals']['work_total'] == 5
    assert StaffAssignment.objects.get().staff == member
    assert WorkSummary.objects.get().scope == 'automation'


@pytest.mark.django_db
def test_common_data_edit_and_delete_respect_foreign_keys(client, base):
    client.force_login(get_user_model().objects.create_user(username='setup@example.com', is_staff=True))
    assert save(client, 'resources', [resource()]).status_code == 200
    assert client.delete(ADMIN + 'common/regions/101/').status_code == 400
    assert client.patch(ADMIN + 'common/regions/101/', {'region_name': '변경한 리전'}, format='json').status_code == 200
    assert Region.objects.get().region_name == '변경한 리전'
    assert InfrastructureResource.objects.exists()
    assert client.post(ADMIN + 'common/services/', {'service_code': 'EMPTY', 'service_name': '미사용'}, format='json').status_code == 201
    assert client.delete(ADMIN + 'common/services/EMPTY/').status_code == 204


@pytest.mark.django_db
def test_login_restoration_and_master_permissions(client, base, settings):
    settings.DEVELOPMENT_AUTH_BYPASS = False
    client.logout()
    assert client.get(ROOT + 'current/').status_code == 403
    user = get_user_model().objects.create_user(username='member@example.com')
    client.force_login(user)
    assert client.get(ROOT + 'current/').status_code == 200
    assert save(client, 'resources', [resource()]).status_code == 403
    assert client.post(ADMIN + 'common/regions/', {'region_name': '신규'}, format='json').status_code == 403


@pytest.mark.django_db
def test_development_writes_require_csrf(base):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(get_user_model().objects.create_user(username='csrf-admin@example.com', is_staff=True))
    assert save(client, 'resources', [resource()]).status_code == 403
    client.get('/api/app-config/')
    token = client.cookies['csrftoken'].value
    assert client.put(ADMIN + 'sections/resources/', {'revision': 0, 'rows': [resource()]}, format='json', HTTP_X_CSRFTOKEN=token).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize('role', ['anonymous', 'member', 'inactive_admin'])
def test_only_active_admin_can_write_even_when_development_bypass_enabled(base, role):
    client = APIClient()
    if role != 'anonymous':
        user = get_user_model().objects.create_user(username=f'{role}@example.com', is_staff=role == 'inactive_admin', is_active=role != 'inactive_admin')
        client.force_authenticate(user)
    assert client.get(ROOT + 'current/').status_code == 200
    issue = RegionalIssue.objects.create(region_id=101, title='원본 이슈')
    before_revision = DataState.objects.get(pk=1).revision
    for method, path, values in [
        ('put', ADMIN + 'sections/resources/', {'revision': before_revision, 'rows': [resource()]}),
        ('put', ADMIN + 'sections/issues/', {'revision': before_revision, 'rows': []}),
        ('post', ADMIN + f'issues/{issue.pk}/comments/', {'revision': before_revision, 'content': '등록 금지'}),
        ('post', ADMIN + 'common/regions/', {'region_name': '차단'}),
        ('patch', ADMIN + 'common/regions/101/', {'region_name': '차단'}),
        ('delete', ADMIN + 'common/regions/101/', {}),
    ]:
        response = getattr(client, method)(path, values, format='json')
        assert response.status_code == 403, (role, path, response.data)
    assert not InfrastructureResource.objects.exists() and not IssueComment.objects.exists()
    assert Region.objects.get().region_name == '테스트 리전'
    assert RegionalIssue.objects.get().title == '원본 이슈'
    assert DataState.objects.get(pk=1).revision == before_revision


@pytest.mark.django_db
def test_old_non_db_write_routes_removed_for_admin_as_well(client, base):
    for method, path in [
        ('put', 'sections/resources/'), ('post', 'master/regions/'),
        ('patch', 'master/regions/KR-TEST/'), ('delete', 'master/regions/KR-TEST/'),
        ('post', 'issues/1/comments/'),
    ]:
        assert getattr(client, method)(ROOT + path, {}, format='json').status_code == 404


@pytest.mark.django_db
def test_storage_rack_is_only_rack_field_and_aggregate(client, base):
    assert save(client, 'resources', [resource(storage_count=7)]).status_code == 200
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['totals']['storage'] == 7
    assert snapshot['totals']['missing_storage_rows'] == 0
    assert 'compute_racks' not in snapshot['totals']
    assert 'compute_rack_count' not in snapshot['resources'][0]
    with connection.cursor() as cursor:
        columns = connection.introspection.get_table_description(cursor, 'infra_resources')
    assert 'compute_rack_count' not in {column.name for column in columns}


@pytest.mark.django_db
def test_current_columns_and_staff_job_fields(client, base):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, 'staff', [{'country_code': 'KR', 'staff': member.pk, 'job_title': '매니저', 'company_name': '회사', 'job_description': '인프라 운영', 'work_location': '상암'}])
    assert response.status_code == 200, response.data
    row = client.get(ROOT + 'current/').data['staff'][0]
    assert (row['job_title'], row['job_description'], row['work_location']) == ('매니저', '인프라 운영', '상암')
    assert not {'region', 'role', 'status', 'work_mode', 'remarks'} & row.keys()
    assert row['country_code'] == 'KR'
    assert 'display_order' not in client.get(ROOT + 'bootstrap/').data['regions'][0]
    with connection.cursor() as cursor:
        staff_columns = {col.name for col in connection.introspection.get_table_description(cursor, 'ops_staff_assignments')}
        region_columns = {col.name for col in connection.introspection.get_table_description(cursor, 'ops_regions')}
        infra_columns = {col.name for col in connection.introspection.get_table_description(cursor, 'infra_resources')}
    assert not {'region_code', 'role', 'status', 'work_mode', 'remarks'} & staff_columns
    assert 'country_code' in staff_columns
    assert 'display_order' not in region_columns
    assert {'environment_name', 'storage_count'} <= infra_columns
    assert not {'zone_name', 'storage_rack_count'} & infra_columns


@pytest.mark.django_db
def test_old_client_resource_columns_are_rejected_without_mutation(client, base):
    response = save(client, 'resources', [{'region': 101, 'service': 'TEST', 'zone_name': 'Old', 'storage_rack_count': 7}])
    assert response.status_code == 400
    assert not InfrastructureResource.objects.exists()


@pytest.mark.django_db
def test_copied_resource_can_save_as_new_environment_and_duplicates_are_atomic(client, base):
    assert save(client, 'resources', [resource(storage_count=3)]).status_code == 200
    original = client.get(ROOT + 'current/').data['resources'][0]
    copy = {key: value for key, value in original.items() if key not in ('id', 'updated_at')}
    assert save(client, 'resources', [original, copy], 1).status_code == 400
    assert InfrastructureResource.objects.count() == 1
    copy['environment_name'] = '검증'
    assert save(client, 'resources', [original, copy], 1).status_code == 200
    assert InfrastructureResource.objects.count() == 2
    assert client.get(ROOT + 'current/').data['totals']['storage'] == 6


@pytest.mark.django_db
@pytest.mark.parametrize('country', ['KR', 'EU', 'NA'])
def test_staff_country_can_be_saved_changed_and_deleted_without_regions(client, country):
    member = StaffMember.objects.create(staff_name='운영자')
    values = {'country_code': country, 'staff': member.pk, 'job_title': '매니저', 'company_name': '회사'}
    assert not Region.objects.exists()
    assert save(client, 'staff', [values]).status_code == 200
    row = client.get(ROOT + 'current/').data['staff'][0]
    assert row['country_code'] == country and 'region' not in row
    assert StaffAssignment.objects.get().country_code == country
    assert save(client, 'staff', [{**row, 'country_code': 'NA'}], 1).status_code == 200
    assert StaffAssignment.objects.get().country_code == 'NA'
    assert save(client, 'staff', [], 2).status_code == 200
    assert not StaffAssignment.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize('country', ['CN', 'KR-SANGAM', '', None])
def test_staff_invalid_country_is_rejected_atomically(client, country):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, 'staff', [{'country_code': country, 'staff': member.pk, 'job_title': '운영', 'company_name': '회사'}])
    assert response.status_code == 400
    assert not StaffAssignment.objects.exists() and not DataState.objects.exists()


@pytest.mark.django_db
def test_staff_old_region_request_is_rejected(client, base):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, 'staff', [{'country_code': 'KR', 'region': 101, 'staff': member.pk, 'job_title': '운영', 'company_name': '회사'}])
    assert response.status_code == 400
    assert not StaffAssignment.objects.exists()


@pytest.mark.django_db
def test_staff_country_constraint_protects_direct_database_writes(db):
    from django.db import IntegrityError, transaction

    member = StaffMember.objects.create(staff_name='운영자')
    with pytest.raises(IntegrityError), transaction.atomic():
        StaffAssignment.objects.create(country_code='CN', staff=member, job_title='운영', company_name='회사')


@pytest.mark.django_db
@pytest.mark.parametrize('role', ['anonymous', 'member', 'inactive_admin', 'admin'])
def test_change_history_is_admin_only_in_api_and_snapshot(role):
    ChangeLog.objects.create(section='resources', action='update', actor_name='관리자', summary='관리자 이력')
    client = APIClient()
    if role != 'anonymous':
        user = get_user_model().objects.create_user(
            username=f'{role}@example.com', is_staff=role in ('admin', 'inactive_admin'), is_active=role != 'inactive_admin',
        )
        client.force_authenticate(user)
    assert client.get(ROOT + 'current/').status_code == 200
    logs = client.get(ROOT + 'current/').data['logs']
    response = client.get(ROOT + 'logs/')
    if role == 'admin':
        assert response.status_code == 200 and response.data[0]['summary'] == '관리자 이력'
        assert len(logs) == 1
    else:
        assert response.status_code == 403 and logs == []
