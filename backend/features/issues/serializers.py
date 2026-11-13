from rest_framework import serializers

from core.roles import can_modify
from reporting.serializers import RowSerializer, month_field

from .models import IssueComment, RegionalIssue


def _can_edit(serializer, author_username):
    # 아이디는 응답에 넣지 않고, 요청한 사용자가 수정·삭제할 수 있는지만 알려 줍니다.
    request = serializer.context.get('request')
    return bool(request and can_modify(request.user, author_username))


class CommentSerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = IssueComment
        fields = ['id', 'author_name', 'content', 'created_at', 'can_edit']
        read_only_fields = fields

    def get_can_edit(self, obj):
        return _can_edit(self, obj.author_username)


class IssueSerializer(RowSerializer):
    owner_name = serializers.CharField(source='owner.staff_name', read_only=True, default='')
    comments = CommentSerializer(many=True, read_only=True)
    can_edit = serializers.SerializerMethodField()
    month = month_field()

    class Meta(RowSerializer.Meta):
        model = RegionalIssue
        fields = ['id', 'month', 'region', 'title', 'description', 'severity', 'status', 'progress_percent', 'owner', 'owner_name', 'next_action', 'author_name', 'comments', 'updated_at', 'can_edit']
        read_only_fields = ['updated_at', 'author_name']

    def get_can_edit(self, obj):
        return _can_edit(self, obj.author_username)

    def validate(self, data):
        progress = data.get('progress_percent', 0)
        if progress > 100:
            raise serializers.ValidationError({'progress_percent': '진행률은 0~100 사이로 입력하세요.'})
        if data.get('status') == 'resolved' and progress != 100:
            raise serializers.ValidationError({'progress_percent': '완료 상태의 진행률은 100%여야 합니다.'})
        return data


class AdminCommentSerializer(serializers.ModelSerializer):
    """DB 관리 > 기능별 설정 > 이슈 댓글에서 쓰는 형식. 작성자 이름·아이디도 직접 입력합니다."""

    issue_title = serializers.CharField(source='issue.title', read_only=True)
    month = serializers.DateField(source='issue.period_month', format='%Y-%m', read_only=True)

    class Meta:
        model = IssueComment
        fields = ['id', 'issue', 'issue_title', 'month', 'author_name', 'author_username', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {'content': {'max_length': 5000}, 'author_name': {'allow_blank': False}}
