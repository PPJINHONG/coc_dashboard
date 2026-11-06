# 운영 인력 배치 저장 규칙: 국가 코드(KR·EU·NA)·직책·업무·근무지, 예전 열 거절.
import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from features.staff.models import StaffAssignment
from reporting.models import DataState, Region, StaffMember

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


def save(client, rows, revision=0):
    return client.put(ADMIN + 'sections/staff/', {'revision': revision, 'rows': rows}, format='json')


@pytest.mark.django_db
def test_staff_persists_current_values(client, base):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, [{'country_code': 'KR', 'staff': member.pk, 'job_title': '운영', 'company_name': '회사'}])
    assert response.status_code == 200, response.data
    assert client.get(ROOT + 'current/').data['totals']['staff'] == 1
    assert StaffAssignment.objects.get().staff == member


@pytest.mark.django_db
def test_current_columns_and_staff_job_fields(client, base):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, [{'country_code': 'KR', 'staff': member.pk, 'job_title': '매니저', 'company_name': '회사', 'job_description': '인프라 운영', 'work_location': '상암'}])
    assert response.status_code == 200, response.data
    row = client.get(ROOT + 'current/').data['staff'][0]
    assert (row['job_title'], row['job_description'], row['work_location']) == ('매니저', '인프라 운영', '상암')
    assert not {'region', 'role', 'status', 'work_mode', 'remarks'} & row.keys()
    assert row['country_code'] == 'KR'
    with connection.cursor() as cursor:
        staff_columns = {col.name for col in connection.introspection.get_table_description(cursor, 'ops_staff_assignments')}
    assert not {'region_code', 'role', 'status', 'work_mode', 'remarks'} & staff_columns
    assert 'country_code' in staff_columns


@pytest.mark.django_db
@pytest.mark.parametrize('country', ['KR', 'EU', 'NA'])
def test_staff_country_can_be_saved_changed_and_deleted_without_regions(client, country):
    member = StaffMember.objects.create(staff_name='운영자')
    values = {'country_code': country, 'staff': member.pk, 'job_title': '매니저', 'company_name': '회사'}
    assert not Region.objects.exists()
    assert save(client, [values]).status_code == 200
    row = client.get(ROOT + 'current/').data['staff'][0]
    assert row['country_code'] == country and 'region' not in row
    assert StaffAssignment.objects.get().country_code == country
    assert save(client, [{**row, 'country_code': 'NA'}], 1).status_code == 200
    assert StaffAssignment.objects.get().country_code == 'NA'
    assert save(client, [], 2).status_code == 200
    assert not StaffAssignment.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize('country', ['CN', 'KR-SANGAM', '', None])
def test_staff_invalid_country_is_rejected_atomically(client, country):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, [{'country_code': country, 'staff': member.pk, 'job_title': '운영', 'company_name': '회사'}])
    assert response.status_code == 400
    assert not StaffAssignment.objects.exists() and not DataState.objects.exists()


@pytest.mark.django_db
def test_staff_old_region_request_is_rejected(client, base):
    member = StaffMember.objects.create(staff_name='운영자')
    response = save(client, [{'country_code': 'KR', 'region': 101, 'staff': member.pk, 'job_title': '운영', 'company_name': '회사'}])
    assert response.status_code == 400
    assert not StaffAssignment.objects.exists()


@pytest.mark.django_db
def test_staff_country_constraint_protects_direct_database_writes(db):
    from django.db import IntegrityError, transaction

    member = StaffMember.objects.create(staff_name='운영자')
    with pytest.raises(IntegrityError), transaction.atomic():
        StaffAssignment.objects.create(country_code='CN', staff=member, job_title='운영', company_name='회사')
