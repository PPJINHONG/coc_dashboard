from rest_framework import serializers

from .models import (
    ChangeLog, IssueComment, Region, Service, StaffMember,
    RegionalIssue, InfrastructureResource, StaffAssignment, WorkSummary,
)


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ['id', 'region_name', 'country_code']


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['service_code', 'service_name']


class StaffMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffMember
        fields = ['id', 'staff_name']


class RowSerializer(serializers.ModelSerializer):
    retired_fields = ()

    def to_internal_value(self, data):
        if any(key in data for key in self.retired_fields):
            raise serializers.ValidationError({'non_field_errors': ['데이터 열이 변경되었습니다. 화면을 새로고침한 후 다시 편집하세요.']})
        return super().to_internal_value(data)

    id = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        validators = []


class ResourceSerializer(RowSerializer):
    retired_fields = ('zone_name', 'storage_rack_count')

    class Meta(RowSerializer.Meta):
        model = InfrastructureResource
        fields = ['id', 'region', 'service', 'environment_name', 'host_count', 'vm_count', 'storage_count', 'remarks', 'updated_at']
        read_only_fields = ['updated_at']


class StaffSerializer(RowSerializer):
    retired_fields = ('region', 'role', 'status', 'work_mode', 'remarks')

    staff_name = serializers.CharField(source='staff.staff_name', read_only=True)

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'country_code', 'staff', 'staff_name', 'job_title', 'company_name', 'job_description', 'work_location']


class WorkSerializer(RowSerializer):
    class Meta(RowSerializer.Meta):
        model = WorkSummary
        fields = ['id', 'region', 'work_type', 'scope', 'total_count', 'completed_count', 'batch_count', 'delayed_count', 'mttr_minutes', 'remarks']

    def validate(self, data):
        total = data.get('total_count', 0)
        completed = data.get('completed_count', 0)
        if completed > total:
            raise serializers.ValidationError({'completed_count': '완료 건수는 전체 건수를 넘을 수 없습니다.'})
        if data.get('batch_count', 0) > total:
            raise serializers.ValidationError({'batch_count': '정기배치는 전체 건수를 넘을 수 없습니다.'})
        if data.get('delayed_count', 0) > total - completed:
            raise serializers.ValidationError({'delayed_count': '지연 건수는 미완료 건수를 넘을 수 없습니다.'})
        mttr = data.get('mttr_minutes')
        if mttr is not None and (mttr < 0 or data.get('work_type') != 'incident'):
            raise serializers.ValidationError({'mttr_minutes': '복구시간은 장애대응에만 0 이상의 값으로 입력하세요.'})
        return data


def _can_edit(serializer, author_username):
    # 아이디는 응답에 넣지 않고, 요청한 사용자가 수정·삭제할 수 있는지만 알려 줍니다.
    from core.roles import can_modify

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

    class Meta(RowSerializer.Meta):
        model = RegionalIssue
        fields = ['id', 'region', 'title', 'description', 'severity', 'status', 'progress_percent', 'owner', 'owner_name', 'next_action', 'author_name', 'comments', 'updated_at', 'can_edit']
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


class ChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeLog
        fields = ['id', 'section', 'action', 'actor_name', 'summary', 'before_data', 'after_data', 'created_at']
