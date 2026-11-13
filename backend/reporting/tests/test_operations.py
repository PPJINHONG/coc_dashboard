# 운영 공통 API: 현재값 조회·동시 수정 버전·공통데이터·관리자 전용 쓰기·변경 이력.
# 기능별 저장 규칙은 각 기능 앱(backend/features/<기능>/tests)에 있습니다.
import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from features.resources.models import InfrastructureResource
from reporting.models import ChangeLog, DataState, Region, Service

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
    return {'region': 101, 'service': 'TEST', 'host_count': 12, 'vm_count': None, **values}


def save(client, section, rows, revision=0):
    return client.put(ADMIN + f'sections/{section}/', {'revision': revision, 'rows': rows}, format='json')


@pytest.mark.django_db
def test_first_setup_is_empty_and_manual_reference_data_is_shared(client):
    bootstrap = client.get(ROOT + 'bootstrap/').data
    assert bootstrap['regions'] == [] and bootstrap['services'] == [] and bootstrap['staff_members'] == []
    assert 'weeks' not in bootstrap and 'current_week' not in bootstrap
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['resources'] == []
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
    before_revision = DataState.objects.get(pk=1).revision
    for method, path, values in [
        ('put', ADMIN + 'sections/resources/', {'revision': before_revision, 'rows': [resource()]}),
        ('post', ADMIN + 'common/regions/', {'region_name': '차단'}),
        ('patch', ADMIN + 'common/regions/101/', {'region_name': '차단'}),
        ('delete', ADMIN + 'common/regions/101/', {}),
    ]:
        response = getattr(client, method)(path, values, format='json')
        assert response.status_code == 403, (role, path, response.data)
    assert not InfrastructureResource.objects.exists()
    assert Region.objects.get().region_name == '테스트 리전'
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
def test_region_global_region_is_derived_from_country(base):
    for name, code in [('국내', 'KR'), ('중국', 'CN'), ('유럽 리전', 'EU'), ('북미 리전', 'NA'), ('기타', 'JP')]:
        Region.objects.create(region_name=name, country_code=code)
    values = dict(Region.objects.values_list('country_code', 'global_region'))
    assert values == {'KR': '내수', 'CN': '내수', 'EU': '유럽', 'NA': '북미', 'JP': None}
    region = Region.objects.get(country_code='JP')
    region.country_code = 'EU'
    region.save()
    region.refresh_from_db()
    assert region.global_region == '유럽'


@pytest.mark.django_db
def test_region_has_no_display_order(client, base):
    assert 'display_order' not in client.get(ROOT + 'bootstrap/').data['regions'][0]
    with connection.cursor() as cursor:
        region_columns = {col.name for col in connection.introspection.get_table_description(cursor, 'ops_regions')}
    assert 'display_order' not in region_columns


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
