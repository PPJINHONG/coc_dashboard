"""리전 이슈·댓글의 사용자용 작성·수정·삭제 API.

권한 규칙
- 관리자: 모든 이슈·댓글을 수정·삭제합니다.
- 사용자: 이슈·댓글을 작성하고, 본인이 작성한 것만 수정·삭제합니다.
- 옵저버: 조회만 가능합니다(모든 쓰기 요청 403).
모든 변경은 운영 변경 이력(ChangeLog)과 사용자 행동 이력(UserActivity)에 남깁니다.
삭제는 원본 전체(댓글 포함)를, 수정은 이전 값과 새 값을 기록합니다.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import CanWrite, can_modify, display_name, record_activity

from .models import IssueComment, RegionalIssue
from .serializers import IssueSerializer
from .services import bump, lock_state, record_log

ISSUE_FIELDS = ['region', 'title', 'description', 'severity', 'status', 'progress_percent', 'owner', 'next_action']


def issue_snapshot(issue):
    """이력에 남길 이슈 원본. 사람이 읽을 수 있도록 리전·담당자 이름과 댓글을 함께 담습니다."""
    return {
        'id': issue.pk,
        'region': issue.region_id,
        'region_name': issue.region.region_name,
        'title': issue.title,
        'description': issue.description,
        'severity': issue.severity,
        'status': issue.status,
        'progress_percent': issue.progress_percent,
        'owner': issue.owner_id,
        'owner_name': issue.owner.staff_name if issue.owner_id else '',
        'next_action': issue.next_action,
        'author_name': issue.author_name,
        'author_username': issue.author_username,
        'comments': [comment_snapshot(c) for c in issue.comments.all()],
    }


def comment_snapshot(comment):
    return {
        'id': comment.pk,
        'issue': comment.issue_id,
        'author_name': comment.author_name,
        'author_username': comment.author_username,
        'content': comment.content,
        'created_at': comment.created_at.isoformat() if comment.created_at else None,
    }


def comment_content(request):
    content = request.data.get('content') if isinstance(request.data, dict) else None
    if not isinstance(content, str) or not content.strip() or len(content) > 5000:
        raise ValidationError({'content': ['댓글은 1~5000자로 입력하세요.']})
    return content.strip()


def require_modify(request, author_username, label):
    if not can_modify(request.user, author_username):
        raise PermissionDenied(f'{label}은(는) 작성자 본인 또는 관리자만 수정·삭제할 수 있습니다.')


def issue_payload(request, issue=None):
    if not isinstance(request.data, dict):
        raise ValidationError('객체 형식으로 요청하세요.')
    values = {key: request.data[key] for key in ISSUE_FIELDS if key in request.data}
    if issue is not None:
        # 일부 항목만 보내도 완료 상태·진행률 규칙을 전체 값 기준으로 검사합니다.
        current = {'region': issue.region_id, 'title': issue.title, 'description': issue.description,
                   'severity': issue.severity, 'status': issue.status, 'progress_percent': issue.progress_percent,
                   'owner': issue.owner_id, 'next_action': issue.next_action}
        values = {**current, **values}
    return values


@method_decorator(csrf_protect, name='dispatch')
class UserWriteView(APIView):
    permission_classes = [CanWrite]


class IssueCreateView(UserWriteView):
    @transaction.atomic
    def post(self, request):
        state = lock_state()
        serializer = IssueSerializer(data=issue_payload(request), context={'request': request})
        serializer.is_valid(raise_exception=True)
        issue = serializer.save(author_name=display_name(request.user), author_username=request.user.username)
        bump(state)
        after = issue_snapshot(issue)
        record_log(request, 'issues', 'create', f'이슈 #{issue.pk} 등록', after=after)
        record_activity(request, 'create', f'리전 이슈 #{issue.pk} 등록: {issue.title}', 'issue', issue.pk, after=after)
        return Response({'revision': state.revision, 'row': IssueSerializer(issue, context={'request': request}).data}, status=201)


class IssueDetailView(UserWriteView):
    def get_issue(self, pk):
        return get_object_or_404(RegionalIssue.objects.select_for_update(of=('self',)).select_related('region', 'owner'), pk=pk)

    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        issue = self.get_issue(pk)
        require_modify(request, issue.author_username, '이슈')
        before = issue_snapshot(issue)
        serializer = IssueSerializer(issue, data=issue_payload(request, issue), context={'request': request})
        serializer.is_valid(raise_exception=True)
        issue = serializer.save()
        issue.refresh_from_db()
        bump(state)
        after = issue_snapshot(issue)
        record_log(request, 'issues', 'update', f'이슈 #{issue.pk} 수정', before=before, after=after)
        record_activity(request, 'update', f'리전 이슈 #{issue.pk} 수정: {issue.title}', 'issue', issue.pk, before=before, after=after)
        return Response({'revision': state.revision, 'row': IssueSerializer(issue, context={'request': request}).data})

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        issue = self.get_issue(pk)
        require_modify(request, issue.author_username, '이슈')
        before = issue_snapshot(issue)
        # 이슈에 달린 댓글(다른 사람 댓글 포함)도 함께 지우고, 원본은 이력에 보관합니다.
        issue.comments.all().delete()
        issue.delete()
        bump(state)
        record_log(request, 'issues', 'delete', f'이슈 #{pk} 삭제', before=before)
        record_activity(request, 'delete', f'리전 이슈 #{pk} 삭제: {before["title"]} (댓글 {len(before["comments"])}개 포함)', 'issue', pk, before=before)
        return Response({'revision': state.revision}, status=200)


class IssueCommentCreateView(UserWriteView):
    @transaction.atomic
    def post(self, request, pk):
        state = lock_state()
        issue = get_object_or_404(RegionalIssue, pk=pk)
        comment = IssueComment.objects.create(issue=issue, content=comment_content(request),
                                              author_name=display_name(request.user), author_username=request.user.username)
        bump(state)
        after = comment_snapshot(comment)
        record_log(request, 'issues', 'comment', f'이슈 #{issue.pk} 댓글 추가', after=after)
        record_activity(request, 'create', f'리전 이슈 #{issue.pk} 댓글 작성', 'issue_comment', comment.pk, after=after)
        return Response({'revision': state.revision}, status=201)


class IssueCommentDetailView(UserWriteView):
    def get_comment(self, pk):
        return get_object_or_404(IssueComment.objects.select_for_update(), pk=pk)

    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        comment = self.get_comment(pk)
        require_modify(request, comment.author_username, '댓글')
        before = comment_snapshot(comment)
        comment.content = comment_content(request)
        comment.save(update_fields=['content'])
        bump(state)
        after = comment_snapshot(comment)
        record_log(request, 'issues', 'comment_update', f'이슈 #{comment.issue_id} 댓글 수정', before=before, after=after)
        record_activity(request, 'update', f'리전 이슈 #{comment.issue_id} 댓글 수정', 'issue_comment', comment.pk, before=before, after=after)
        return Response({'revision': state.revision})

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        comment = self.get_comment(pk)
        require_modify(request, comment.author_username, '댓글')
        before = comment_snapshot(comment)
        comment.delete()
        bump(state)
        record_log(request, 'issues', 'comment_delete', f'이슈 #{before["issue"]} 댓글 삭제', before=before)
        record_activity(request, 'delete', f'리전 이슈 #{before["issue"]} 댓글 삭제', 'issue_comment', pk, before=before)
        return Response({'revision': state.revision})
