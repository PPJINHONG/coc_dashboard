# 인프라 자원 현재값 저장 규칙: 수량 검사·원자적 저장·Rack 열·예전 열 거절·행 복사.
import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from features.resources.models import InfrastructureResource
from reporting.models import DataState, Region

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


def resource(**values):
    return {'region': 101, 'service': 'HCLOUD', 'host_count': 12, 'vm_count': None, **values}


def save(client, rows, revision=0):
    return client.put(ADMIN + 'sections/resources/', {'revision': revision, 'rows': rows}, format='json')


@pytest.mark.django_db
@pytest.mark.parametrize('rows', [
    [resource(host_count=-1)],
    [resource(service='')],
    [resource(service='X' * 81)],
    [resource(), resource()],
    [resource(region='missing')],
])
def test_invalid_resource_edits_are_atomic(client, base, rows):
    assert save(client, rows).status_code == 400
    assert not InfrastructureResource.objects.exists()
    assert DataState.objects.count() == 0


@pytest.mark.django_db
def test_deleting_current_row_removes_it_from_database(client, base):
    assert save(client, [resource()]).status_code == 200
    assert save(client, [], 1).status_code == 200
    assert not InfrastructureResource.objects.exists()
    assert client.get(ROOT + 'current/').data['resources'] == []


@pytest.mark.django_db
def test_compute_and_storage_rack_fields(client, base):
    assert save(client, [resource(storage_count=7)]).status_code == 200
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['totals']['storage'] == 7
    assert snapshot['totals']['missing_storage_rows'] == 0
    assert snapshot['resources'][0]['compute_rack_count'] is None
    row = {key: value for key, value in snapshot['resources'][0].items() if key != 'updated_at'}
    assert save(client, [{**row, 'compute_rack_count': 4}], 1).status_code == 200
    assert client.get(ROOT + 'current/').data['resources'][0]['compute_rack_count'] == 4
    assert save(client, [{**row, 'compute_rack_count': -1}], 2).status_code == 400
    with connection.cursor() as cursor:
        columns = connection.introspection.get_table_description(cursor, 'infra_resources')
    assert {'compute_rack_count', 'storage_count'} <= {column.name for column in columns}


@pytest.mark.django_db
def test_current_resource_columns_and_unique_constraint(db):
    with connection.cursor() as cursor:
        infra_columns = {col.name for col in connection.introspection.get_table_description(cursor, 'infra_resources')}
        constraints = connection.introspection.get_constraints(cursor, 'infra_resources')
    assert {'service', 'storage_count'} <= infra_columns
    assert 'service_code' not in infra_columns
    assert not {'zone_name', 'storage_rack_count', 'environment_name'} & infra_columns
    assert constraints['unique_monthly_resource_service']['columns'] == ['period_month', 'region_id', 'service']
    assert constraints['resource_valid_service']['columns'] == ['service']
    assert 'unique_current_resource_service' not in constraints
    assert 'unique_current_resource_environment' not in constraints


@pytest.mark.django_db
@pytest.mark.parametrize('retired', [{'zone_name': 'Old', 'storage_rack_count': 7}, {'environment_name': '운영'}])
def test_old_client_resource_columns_are_rejected_without_mutation(client, base, retired):
    response = save(client, [{'region': 101, 'service': 'HCLOUD', **retired}])
    assert response.status_code == 400
    assert not InfrastructureResource.objects.exists()


@pytest.mark.django_db
def test_copied_resource_can_save_as_new_service_and_duplicates_are_atomic(client, base):
    assert save(client, [resource(storage_count=3)]).status_code == 200
    original = client.get(ROOT + 'current/').data['resources'][0]
    assert 'environment_name' not in original
    copy = {key: value for key, value in original.items() if key not in ('id', 'updated_at')}
    assert save(client, [original, copy], 1).status_code == 400
    assert InfrastructureResource.objects.count() == 1
    copy['service'] = 'CCS'
    assert save(client, [original, copy], 1).status_code == 200
    assert InfrastructureResource.objects.count() == 2
    assert client.get(ROOT + 'current/').data['totals']['storage'] == 6


def test_resource_trend_limits_months_and_keeps_missing_values(client, base, settings):
    from datetime import date

    for month in [date(2025, 12, 1), date(2026, 1, 1), date(2026, 3, 1)]:
        InfrastructureResource.objects.create(period_month=month, region_id=101, service='HCLOUD', host_count=0)
    url = ROOT + 'resources/trend/'
    response = client.get(url, {'month': '2026-03', 'months': 3})
    assert response.status_code == 200
    assert set(response.data) == {'2026-01', '2026-03'}
    assert response.data['2026-03'][0]['host_count'] == 0
    assert response.data['2026-03'][0]['vm_count'] is None
    assert set(client.get(url, {'month': '2026-03', 'months': 6}).data) == {'2025-12', '2026-01', '2026-03'}
    assert client.get(url, {'months': 13}).status_code == 400
    settings.DEVELOPMENT_AUTH_BYPASS = False
    assert APIClient().get(url).status_code == 403


@pytest.mark.django_db
def test_resource_tab_create_update_and_delete_record_history(client, base):
    from core.models import UserActivity
    from reporting.models import ChangeLog

    payload = {
        'revision': 0,
        'month': '2026-11',
        'region': 101,
        'service': 'HCLOUD',
        'host_count': 12,
        'vm_count': None,
        'compute_rack_count': 3,
        'storage_count': 4,
        'remarks': '최초 등록',
    }
    created = client.post(ROOT + 'resources/', payload, format='json')
    assert created.status_code == 201, created.data
    resource_id = created.data['row']['id']
    resource_row = InfrastructureResource.objects.get(pk=resource_id)
    assert resource_row.period_month.isoformat() == '2026-11-01'
    assert created.data['revision'] == 1

    updated = client.patch(
        ROOT + f'resources/{resource_id}/',
        {**payload, 'revision': 1, 'host_count': 21, 'remarks': '수정 완료'},
        format='json',
    )
    assert updated.status_code == 200, updated.data
    assert updated.data['revision'] == 2
    resource_row.refresh_from_db()
    assert resource_row.host_count == 21
    assert resource_row.remarks == '수정 완료'

    deleted = client.delete(
        ROOT + f'resources/{resource_id}/',
        {'revision': 2, 'month': '2026-11'},
        format='json',
    )
    assert deleted.status_code == 200, deleted.data
    assert deleted.data['revision'] == 3
    assert not InfrastructureResource.objects.exists()
    assert list(ChangeLog.objects.values_list('action', flat=True)) == ['delete', 'update', 'create']
    assert list(
        UserActivity.objects.filter(target_type='infrastructure_resource').values_list('action', flat=True)
    ) == ['delete', 'update', 'create']
    assert ChangeLog.objects.first().before_data['id'] == resource_id


@pytest.mark.django_db
def test_resource_tab_writes_are_admin_only(base, settings):
    settings.DEVELOPMENT_AUTH_BYPASS = False
    payload = {
        'revision': 0,
        'month': '2026-11',
        'region': 101,
        'service': 'HCLOUD',
        'host_count': 1,
    }
    anonymous = APIClient()
    assert anonymous.post(ROOT + 'resources/', payload, format='json').status_code == 403
    assert anonymous.patch(ROOT + 'resources/1/', payload, format='json').status_code == 403
    assert anonymous.delete(ROOT + 'resources/1/', payload, format='json').status_code == 403

    user = get_user_model().objects.create_user(username='resource-user@example.com')
    member = APIClient()
    member.force_login(user)
    assert member.post(ROOT + 'resources/', payload, format='json').status_code == 403
    assert member.patch(ROOT + 'resources/1/', payload, format='json').status_code == 403
    assert member.delete(ROOT + 'resources/1/', payload, format='json').status_code == 403
    assert not InfrastructureResource.objects.exists()


@pytest.mark.django_db
def test_resource_tab_rejects_duplicate_and_wrong_month(client, base):
    payload = {
        'revision': 0,
        'month': '2026-11',
        'region': 101,
        'service': 'HCLOUD',
        'host_count': 1,
    }
    created = client.post(ROOT + 'resources/', payload, format='json')
    assert created.status_code == 201
    resource_id = created.data['row']['id']
    duplicate = client.post(ROOT + 'resources/', {**payload, 'revision': 1}, format='json')
    assert duplicate.status_code == 400
    assert InfrastructureResource.objects.count() == 1
    assert DataState.objects.get(pk=1).revision == 1
    wrong_month = client.patch(
        ROOT + f'resources/{resource_id}/',
        {**payload, 'revision': 1, 'month': '2026-12', 'host_count': 2},
        format='json',
    )
    assert wrong_month.status_code == 404
    assert InfrastructureResource.objects.get(pk=resource_id).host_count == 1
