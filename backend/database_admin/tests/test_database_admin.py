import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from database_admin.models import DatabaseChangeLog
from reporting.models import IssueComment, Region, RegionalIssue, Service, StaffAssignment, StaffMember

ROOT = '/api/db-admin/'


@pytest.fixture(autouse=True)
def development(settings):
    settings.DEVELOPMENT_AUTH_BYPASS = True


@pytest.fixture
def admin(db):
    return get_user_model().objects.create_user(username='admin@example.com', is_staff=True)


@pytest.fixture
def client(admin):
    client = APIClient(); client.force_login(admin)
    return client


@pytest.mark.django_db
@pytest.mark.parametrize('path', ['', 'accounts/', 'comments/', 'tables/auth_user/', 'tables/auth_user/rows/', 'common/regions/', 'sections/resources/', 'issues/1/comments/'])
def test_anonymous_and_non_admin_cannot_access_even_in_development(path):
    client = APIClient()
    assert client.get(ROOT + path).status_code == 403
    user = get_user_model().objects.create_user(username='member@example.com')
    client.force_login(user)
    assert client.get(ROOT + path).status_code == 403


@pytest.mark.django_db
def test_catalog_only_lists_website_tables_and_raw_data_is_readonly(client):
    names = {table['name'] for table in client.get(ROOT).data['tables']}
    assert names == {'auth_user', 'ops_regions', 'ops_services', 'ops_staff_members', 'infra_resources', 'ops_staff_assignments', 'ops_work_summaries', 'ops_regional_issues', 'ops_issue_comments'}
    for name in ('django_session', 'django_migrations', 'auth_permission', 'core_post', 'ops_data_state'):
        assert client.get(ROOT + f'tables/{name}/').status_code == 404
    meta = client.get(ROOT + 'tables/ops_regions/').data
    assert not meta['can_edit_rows'] and not meta['can_insert_rows']
    for method in ('post', 'patch', 'delete'):
        assert getattr(client, method)(ROOT + 'tables/ops_regions/rows/', {'values': {'region_code': 'NO'}}, format='json').status_code == 405
    assert client.post(ROOT + 'tables/ops_regions/columns/', {}, format='json').status_code == 404


@pytest.mark.django_db
def test_feature_reference_edit_appears_in_raw_table_and_bootstrap(client):
    values = {'region_name': '새 리전'}
    response = client.post('/api/db-admin/common/regions/', values, format='json')
    assert response.status_code == 201
    pk = response.data['id']
    raw = client.get(ROOT + 'tables/ops_regions/rows/').data
    assert raw['rows'][0]['values']['region_name'] == '새 리전'
    assert raw['rows'][0]['token'] is None
    assert client.get('/api/operations/bootstrap/').data['regions'][0]['id'] == pk
    assert client.patch(f'/api/db-admin/common/regions/{pk}/', {'region_name': '수정 리전'}, format='json').status_code == 200
    assert client.get(ROOT + 'tables/ops_regions/rows/').data['rows'][0]['values']['region_name'] == '수정 리전'


@pytest.mark.django_db
def test_credentials_hidden_in_raw_metadata_and_rows(client):
    raw = client.get(ROOT + 'tables/auth_user/rows/').data
    assert 'password' not in raw['rows'][0]['values']
    meta = client.get(ROOT + 'tables/auth_user/').data
    assert next(column for column in meta['columns'] if column['name'] == 'password')['default'] is None


@pytest.mark.django_db
def test_account_creation_edit_role_password_login_and_delete(client):
    values = {'name': '운영 사용자', 'username': 'member@example.com', 'password': 'StrongExample!93427', 'is_staff': False, 'is_active': True}
    response = client.post(ROOT + 'accounts/', values, format='json')
    assert response.status_code == 201, response.data
    assert 'password' not in response.data
    pk = response.data['id']
    user = get_user_model().objects.get(pk=pk)
    assert user.check_password(values['password']) and not user.is_staff
    assert APIClient().login(username=user.username, password=values['password'])
    response = client.patch(ROOT + f'accounts/{pk}/', {'name': '권한 변경', 'is_staff': True, 'password': 'ChangedExample!83472'}, format='json')
    assert response.status_code == 200, response.data
    user.refresh_from_db(); assert user.is_staff and user.first_name == '권한 변경' and user.check_password('ChangedExample!83472')
    raw = client.get(ROOT + 'tables/auth_user/rows/').data
    assert any(row['values']['first_name'] == '권한 변경' for row in raw['rows'])
    assert 'StrongExample' not in str(list(DatabaseChangeLog.objects.values()))
    assert 'ChangedExample' not in str(list(DatabaseChangeLog.objects.values()))
    assert client.delete(ROOT + f'accounts/{pk}/', {'confirm_username': user.username}, format='json').status_code == 204
    assert not get_user_model().objects.filter(pk=pk).exists()


@pytest.mark.django_db
def test_own_admin_cannot_be_disabled_demoted_or_deleted(client, admin):
    for values in ({'is_staff': False}, {'is_active': False}):
        assert client.patch(ROOT + f'accounts/{admin.pk}/', values, format='json').status_code == 400
    assert client.delete(ROOT + f'accounts/{admin.pk}/', {'confirm_username': admin.username}, format='json').status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize('changes', [{'username': 'not-email'}, {'password': '12345678'}, {'username': 'admin@example.com'}])
def test_invalid_accounts_are_not_created(client, changes):
    response = client.post(ROOT + 'accounts/', {'name': '사용자', 'username': 'user@example.com', 'password': 'StrongExample!93427', **changes}, format='json')
    assert response.status_code == 400, response.data
    assert get_user_model().objects.count() == 1


@pytest.mark.django_db
def test_feature_comment_crud_updates_actual_table_and_current_view(client):
    region = Region.objects.create(region_name='리전')
    issue = RegionalIssue.objects.create(region=region, title='운영 이슈')
    response = client.post(ROOT + 'comments/', {'issue': issue.pk, 'author_name': '관리자', 'content': '새 댓글'}, format='json')
    assert response.status_code == 201, response.data
    pk = response.data['id']
    assert client.patch(ROOT + f'comments/{pk}/', {'content': '수정 댓글'}, format='json').status_code == 200
    assert IssueComment.objects.get().content == '수정 댓글'
    assert client.get('/api/operations/current/').data['issues'][0]['comments'][0]['content'] == '수정 댓글'
    assert client.get(ROOT + 'tables/ops_issue_comments/rows/').data['rows'][0]['values']['content'] == '수정 댓글'
    assert client.delete(ROOT + f'comments/{pk}/').status_code == 204
    assert not IssueComment.objects.exists()


@pytest.mark.django_db
def test_admin_feature_writes_require_csrf(admin):
    client = APIClient(enforce_csrf_checks=True); client.force_login(admin)
    assert client.post(ROOT + 'accounts/', {}, format='json').status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize('collection,table,values,changed_field,changed_value,bootstrap_key,pk_field', [
    ('regions', 'ops_regions', {'region_name': '새 리전'}, 'region_name', '수정 리전', 'regions', 'id'),
    ('services', 'ops_services', {'service_code': 'NEW', 'service_name': '새 서비스'}, 'service_name', '수정 서비스', 'services', 'service_code'),
    ('staff-members', 'ops_staff_members', {'staff_name': '새 인력'}, 'staff_name', '수정 인력', 'staff_members', 'id'),
])
def test_common_data_has_no_usage_status_and_crud_still_shares_source(client, collection, table, values, changed_field, changed_value, bootstrap_key, pk_field):
    response = client.post(ROOT + f'common/{collection}/', values, format='json')
    assert response.status_code == 201, response.data
    assert 'is_active' not in response.data
    pk = response.data[pk_field]
    meta = client.get(ROOT + f'tables/{table}/').data
    assert 'is_active' not in {column['name'] for column in meta['columns']}
    assert client.patch(ROOT + f'common/{collection}/{pk}/', {changed_field: changed_value}, format='json').status_code == 200
    assert client.get('/api/operations/bootstrap/').data[bootstrap_key][0][changed_field] == changed_value
    raw = client.get(ROOT + f'tables/{table}/rows/').data['rows'][0]['values']
    assert raw[changed_field] == changed_value and 'is_active' not in raw
    # 계정 활성 상태는 Django 인증에 필요한 별도 필드입니다.
    user_meta = client.get(ROOT + 'tables/auth_user/').data
    assert 'is_active' in {column['name'] for column in user_meta['columns']}
    assert client.delete(ROOT + f'common/{collection}/{pk}/').status_code == 204


@pytest.mark.django_db
def test_staff_name_only_preserves_links_and_allows_same_name(client):
    response = client.post(ROOT + 'common/staff-members/', {'staff_name': '운영자'}, format='json')
    assert response.status_code == 201, response.data
    assert set(response.data) == {'id', 'staff_name'}
    pk = response.data['id']
    same_name = client.post(ROOT + 'common/staff-members/', {'staff_name': '운영자'}, format='json')
    assert same_name.status_code == 201 and same_name.data['id'] != pk
    region = Region.objects.create(region_name='연결 확인')
    StaffAssignment.objects.create(country_code='KR', staff_id=pk, job_title='운영', company_name='회사')
    issue = RegionalIssue.objects.create(region=region, title='담당자 연결', owner_id=pk)
    response = client.patch(ROOT + f'common/staff-members/{pk}/', {'staff_name': '새 이름'}, format='json')
    assert response.status_code == 200
    snapshot = client.get('/api/operations/current/').data
    assert snapshot['staff'][0]['staff_name'] == '새 이름'
    assert snapshot['issues'][0]['owner_name'] == '새 이름'
    assert StaffAssignment.objects.get().staff_id == pk
    issue.refresh_from_db()
    assert issue.owner_id == pk
    meta = client.get(ROOT + 'tables/ops_staff_members/').data
    assert {col['name'] for col in meta['columns']} == {'id', 'staff_name'}
    raw = client.get(ROOT + 'tables/ops_staff_members/rows/').data['rows']
    assert all(set(row['values']) == {'id', 'staff_name'} for row in raw)
    assert client.delete(ROOT + f'common/staff-members/{pk}/').status_code == 400
    other_pk = same_name.data['id']
    assert client.delete(ROOT + f'common/staff-members/{other_pk}/').status_code == 204
    assert StaffMember.objects.count() == 1


@pytest.mark.django_db
def test_region_generated_id_preserves_all_feature_links_when_renamed(client):
    from reporting.models import InfrastructureResource, WorkSummary

    created = client.post(ROOT + 'common/regions/', {'region_name': '센터', 'country_code': 'KR'}, format='json')
    assert created.status_code == 201, created.data
    pk = created.data['id']
    assert isinstance(pk, int) and set(created.data) == {'id', 'region_name', 'country_code'}
    Service.objects.create(service_code='CCS', service_name='CCS')
    for revision, section, values in [
        (1, 'resources', {'service': 'CCS', 'environment_name': '운영', 'host_count': 10}),
        (2, 'work', {'work_type': 'request', 'scope': 'infra', 'total_count': 3}),
        (3, 'issues', {'title': '지역 이슈'}),
    ]:
        response = client.put(ROOT + f'sections/{section}/', {'revision': revision, 'rows': [{'region': pk, **values}]}, format='json')
        assert response.status_code == 200, response.data
    renamed = client.patch(ROOT + f'common/regions/{pk}/', {'region_name': '새 센터'}, format='json')
    assert renamed.status_code == 200 and renamed.data['id'] == pk
    assert all(model.objects.get().region_id == pk for model in [InfrastructureResource, WorkSummary, RegionalIssue])
    snapshot = client.get('/api/operations/current/').data
    assert all(snapshot[section][0]['region'] == pk for section in ['resources', 'work', 'issues'])
    assert client.delete(ROOT + f'common/regions/{pk}/').status_code == 400
    meta = client.get(ROOT + 'tables/ops_regions/').data
    assert {column['name'] for column in meta['columns']} == {'id', 'region_name', 'country_code'}
    for table in ['infra_resources', 'ops_work_summaries', 'ops_regional_issues']:
        columns = {column['name'] for column in client.get(ROOT + f'tables/{table}/').data['columns']}
        assert 'region_id' in columns and 'region_code' not in columns
    assert client.patch(ROOT + f'common/regions/{pk}/', {'id': pk + 100}, format='json').status_code == 400
    unused = client.post(ROOT + 'common/regions/', {'region_name': '미사용 센터'}, format='json').data['id']
    assert unused != pk
    assert client.delete(ROOT + f'common/regions/{unused}/').status_code == 204
    assert client.patch(ROOT + 'common/regions/KR-OLD/', {'region_name': '오래된 화면'}, format='json').status_code == 400
    assert client.delete(ROOT + 'common/regions/KR-OLD/').status_code == 400
