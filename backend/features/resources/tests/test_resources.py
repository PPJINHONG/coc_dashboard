# 인프라 자원 현재값 저장 규칙: 수량 검사·원자적 저장·Rack 열·예전 열 거절·행 복사.
import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from features.resources.models import InfrastructureResource
from reporting.models import DataState, Region, Service

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


def save(client, rows, revision=0):
    return client.put(ADMIN + 'sections/resources/', {'revision': revision, 'rows': rows}, format='json')


@pytest.mark.django_db
@pytest.mark.parametrize('rows', [[resource(host_count=-1)], [resource(), resource()], [resource(region='missing')]])
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
    assert 'storage_count' in infra_columns
    assert not {'zone_name', 'storage_rack_count', 'environment_name'} & infra_columns
    assert constraints['unique_monthly_resource_service']['columns'] == ['period_month', 'region_id', 'service_code']
    assert 'unique_current_resource_service' not in constraints
    assert 'unique_current_resource_environment' not in constraints


@pytest.mark.django_db
@pytest.mark.parametrize('retired', [{'zone_name': 'Old', 'storage_rack_count': 7}, {'environment_name': '운영'}])
def test_old_client_resource_columns_are_rejected_without_mutation(client, base, retired):
    response = save(client, [{'region': 101, 'service': 'TEST', **retired}])
    assert response.status_code == 400
    assert not InfrastructureResource.objects.exists()


@pytest.mark.django_db
def test_copied_resource_can_save_as_new_service_and_duplicates_are_atomic(client, base):
    Service.objects.create(service_code='SECOND', service_name='두 번째 서비스')
    assert save(client, [resource(storage_count=3)]).status_code == 200
    original = client.get(ROOT + 'current/').data['resources'][0]
    assert 'environment_name' not in original
    copy = {key: value for key, value in original.items() if key not in ('id', 'updated_at')}
    assert save(client, [original, copy], 1).status_code == 400
    assert InfrastructureResource.objects.count() == 1
    copy['service'] = 'SECOND'
    assert save(client, [original, copy], 1).status_code == 200
    assert InfrastructureResource.objects.count() == 2
    assert client.get(ROOT + 'current/').data['totals']['storage'] == 6
