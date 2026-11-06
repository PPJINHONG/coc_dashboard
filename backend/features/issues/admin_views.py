"""DB 관리(/api/db-admin/)의 이슈 댓글 관리 API. 실제 활성 관리자만 사용합니다."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from database_admin.services import log_change
from database_admin.views import AdminView, payload
from reporting.services import actor, bump, check_revision, lock_state, record_log
from reporting.views import AdminDataView

from .models import IssueComment, RegionalIssue
from .serializers import AdminCommentSerializer, CommentSerializer


class CommentsView(AdminDataView):
    """DB 관리 > 리전 이슈 화면에서 댓글을 등록합니다."""

    @transaction.atomic
    def post(self, request, pk):
        state = lock_state()
        check_revision(state, request.data.get('revision'))
        issue = get_object_or_404(RegionalIssue, pk=pk)
        content = request.data.get('content')
        if not isinstance(content, str) or not content.strip() or len(content) > 5000:
            raise ValidationError({'content': ['댓글은 1~5000자로 입력하세요.']})
        identity = actor(request)
        comment = IssueComment.objects.create(issue=issue, content=content.strip(), author_name=identity['actor_name'], author_username=identity['actor_username'])
        bump(state)
        record_log(request, 'issues', 'comment', f'이슈 #{issue.pk} 댓글 추가')
        return Response(CommentSerializer(comment).data, status=201)


class AdminCommentsView(AdminView):
    """DB 관리 > 기능별 설정 > 이슈 댓글의 목록·추가·수정·삭제."""

    def get(self, request):
        return Response(AdminCommentSerializer(IssueComment.objects.select_related('issue').all(), many=True).data)

    @transaction.atomic
    def post(self, request):
        return self.save(request)

    @transaction.atomic
    def patch(self, request, pk):
        return self.save(request, pk)

    def save(self, request, pk=None):
        state = lock_state()
        instance = get_object_or_404(IssueComment, pk=pk) if pk is not None else None
        before = AdminCommentSerializer(instance).data if instance else {}
        serializer = AdminCommentSerializer(instance, data=payload(request), partial=instance is not None)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        bump(state)
        record_log(request, 'issues', 'comment_update' if instance else 'comment', '관리자 댓글 저장', before=before, after=serializer.data)
        log_change(request, 'update' if instance else 'insert', 'ops_issue_comments', {'before': before, 'changes': serializer.data})
        return Response(serializer.data, status=200 if instance else 201)

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(IssueComment, pk=pk)
        before = AdminCommentSerializer(instance).data
        instance.delete()
        bump(state)
        record_log(request, 'issues', 'comment_delete', '관리자 댓글 삭제', before=before)
        log_change(request, 'delete', 'ops_issue_comments', {'before': before})
        return Response(status=204)
