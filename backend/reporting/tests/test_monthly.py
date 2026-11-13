# 월별 데이터 규칙: 기준 월별 조회·저장, 다른 달 보존, 이번 달 기본값, 변경 이력의 기준 월, 운영 인력은 월 구분 없음.
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from rest_framework.test import APIClient

from features.resources.models import InfrastructureResource
from features.work.models import WorkSummary
from reporting.models import ChangeLog, Region, Service
from reporting.months import current_month

ROOT = '/api/operations/'
ADMIN = '/api/db-admin/'


@pytest.fixture(autouse=True)
def development(settings):
    settings.DEVELOPMENT_AUTH_BYPASS = True


@pytest.fixture
def client(db):
    client = APIClient()
    client.force_login(get_user_model().objects.create_user(username='monthly-admin@example.com', is_staff=True))
    return client


@pytest.fixture
def base(db):
    Region.objects.create(id=101, region_name='테스트 리전')
    Service.objects.create(service_code='TEST', service_name='테스트 서비스')


def resource(**values):
    return {'region': 101, 'service': 'TEST', 'host_count': 12, 'vm_count': None, **values}


def save(client, section, rows, revision, month=None):
    body = {'revision': revision, 'rows': rows}
    if month is not None:
        body['month'] = month
    return client.put(ADMIN + f'sections/{section}/', body, format='json')


@pytest.mark.django_db
def test_saving_one_month_keeps_other_months(client, base):
    assert save(client, 'resources', [resource(host_count=10)], 0, '2026-08').status_code == 200
    assert save(client, 'resources', [resource(host_count=20)], 1, '2026-09').status_code == 200
    # 같은 리전·서비스라도 월이 다르면 다른 행입니다.
    assert InfrastructureResource.objects.count() == 2
    # 9월을 비워 저장해도 8월 행은 남습니다.
    assert save(client, 'resources', [], 2, '2026-09').status_code == 200
    assert list(InfrastructureResource.objects.values_list('period_month', 'host_count')) == [(date(2026, 8, 1), 10)]
    august = client.get(ROOT + 'current/?month=2026-08').data
    assert august['month'] == '2026-08'
    assert august['resources'][0]['month'] == '2026-08'
    assert august['totals']['hosts'] == 10
    assert client.get(ROOT + 'current/?month=2026-09').data['resources'] == []


@pytest.mark.django_db
def test_month_defaults_to_current_month_for_existing_screens(client, base):
    assert save(client, 'resources', [resource()], 0).status_code == 200
    assert InfrastructureResource.objects.get().period_month == current_month()
    snapshot = client.get(ROOT + 'current/').data
    assert snapshot['month'] == current_month().strftime('%Y-%m')
    assert len(snapshot['resources']) == 1


@pytest.mark.django_db
def test_row_id_from_another_month_is_rejected(client, base):
    assert save(client, 'resources', [resource()], 0, '2026-08').status_code == 200
    august_id = InfrastructureResource.objects.get().pk
    response = save(client, 'resources', [resource(id=august_id, host_count=99)], 1, '2026-09')
    assert response.status_code == 400
    assert InfrastructureResource.objects.get().host_count == 12


@pytest.mark.django_db
@pytest.mark.parametrize('month', ['2026-13', '2026/08', '2026-08-15', 'abc'])
def test_invalid_month_is_rejected(client, base, month):
    assert client.get(ROOT + f'current/?month={month}').status_code == 400
    assert save(client, 'resources', [resource()], 0, month).status_code == 400
    assert not InfrastructureResource.objects.exists()


@pytest.mark.django_db
def test_work_unique_per_month(client, base):
    row = {'region': 101, 'work_type': 'request', 'scope': 'infra', 'total_count': 5, 'completed_count': 3}
    assert save(client, 'work', [row], 0, '2026-08').status_code == 200
    assert save(client, 'work', [row, row], 1, '2026-09').status_code == 400
    assert save(client, 'work', [row], 1, '2026-09').status_code == 200
    assert WorkSummary.objects.count() == 2
    assert client.get(ROOT + 'current/?month=2026-09').data['totals']['work_total'] == 5


@pytest.mark.django_db
def test_change_logs_record_month_and_filter(client, base):
    assert save(client, 'resources', [resource()], 0, '2026-08').status_code == 200
    assert client.post(ADMIN + 'common/services/', {'service_code': 'TWO', 'service_name': '둘'}, format='json').status_code == 201
    log = ChangeLog.objects.get(section='resources')
    assert log.period_month == date(2026, 8, 1)
    assert ChangeLog.objects.get(section='services').period_month is None
    logs = client.get(ROOT + 'logs/?month=2026-08').data['results']
    assert [entry['month'] for entry in logs] == ['2026-08']


@pytest.mark.django_db
def test_staff_section_has_no_month(client, base):
    snapshot = client.get(ROOT + 'current/?month=2026-08').data
    assert snapshot['staff'] == []
    with connection.cursor() as cursor:
        columns = {col.name for col in connection.introspection.get_table_description(cursor, 'ops_staff_assignments')}
    assert 'period_month' not in columns


@pytest.mark.django_db
def test_database_rejects_month_not_on_first_day(base):
    with pytest.raises(IntegrityError), transaction.atomic():
        InfrastructureResource.objects.create(period_month=date(2026, 8, 15), region_id=101, service_id='TEST')
