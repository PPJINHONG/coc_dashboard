# 운영 작업 현재값 저장 규칙.
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from features.work.models import WorkSummary
from reporting.models import Region

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


@pytest.mark.django_db
def test_work_persists_current_values(client, base):
    rows = [{'region': 101, 'work_type': 'incident', 'scope': 'automation', 'total_count': 5, 'completed_count': 3, 'mttr_minutes': '10.5'}]
    response = client.put(ADMIN + 'sections/work/', {'revision': 0, 'rows': rows}, format='json')
    assert response.status_code == 200, response.data
    assert client.get(ROOT + 'current/').data['totals']['work_total'] == 5
    assert WorkSummary.objects.get().scope == 'automation'
