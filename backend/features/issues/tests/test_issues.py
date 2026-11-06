# 리전 이슈 현재값 저장·관리자 댓글·작성자 아이디 변경 테스트.
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient

from features.issues.models import IssueComment, RegionalIssue
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


def save(client, rows, revision=0):
    return client.put(ADMIN + 'sections/issues/', {'revision': revision, 'rows': rows}, format='json')


@pytest.mark.django_db
def test_issue_comment_uses_same_persisted_data_without_period(client, base):
    assert save(client, [{'region': 101, 'title': '운영 이슈', 'next_action': '점검'}]).status_code == 200
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
    assert save(client, [{'region': 101, 'title': '이슈', **values}]).status_code == 400
    assert not RegionalIssue.objects.exists()


@pytest.mark.django_db
def test_feature_comment_crud_updates_actual_table_and_current_view(client):
    region = Region.objects.create(region_name='리전')
    issue = RegionalIssue.objects.create(region=region, title='운영 이슈')
    response = client.post(ADMIN + 'comments/', {'issue': issue.pk, 'author_name': '관리자', 'content': '새 댓글'}, format='json')
    assert response.status_code == 201, response.data
    pk = response.data['id']
    assert client.patch(ADMIN + f'comments/{pk}/', {'content': '수정 댓글'}, format='json').status_code == 200
    assert IssueComment.objects.get().content == '수정 댓글'
    assert client.get(ROOT + 'current/').data['issues'][0]['comments'][0]['content'] == '수정 댓글'
    assert client.get(ADMIN + 'tables/ops_issue_comments/rows/').data['rows'][0]['values']['content'] == '수정 댓글'
    assert client.delete(ADMIN + f'comments/{pk}/').status_code == 204
    assert not IssueComment.objects.exists()


@pytest.mark.django_db
def test_ensure_admin_renames_legacy_admin_author_on_issues_and_comments():
    get_user_model().objects.create_superuser(username='admin@admin', email='admin@admin', password='StrongExample!93427')
    issue = RegionalIssue.objects.create(region=Region.objects.create(region_name='리전'), title='이슈',
                                         author_name='admin', author_username='admin@admin')
    IssueComment.objects.create(issue=issue, author_name='admin', author_username='admin@admin', content='댓글')
    call_command('ensure_admin', stdout=StringIO())
    assert RegionalIssue.objects.get().author_username == 'admin'
    assert IssueComment.objects.get().author_username == 'admin'
