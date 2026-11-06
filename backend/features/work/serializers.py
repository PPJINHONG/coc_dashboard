from rest_framework import serializers

from reporting.serializers import RowSerializer

from .models import WorkSummary


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
