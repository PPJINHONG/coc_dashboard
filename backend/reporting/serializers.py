from rest_framework import serializers

from .models import ChangeLog, Region, Service, StaffMember


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
    """기능별 현재값 행의 공통 직렬화. 기능 앱의 serializers.py가 상속합니다."""

    # 열 이름이 바뀐 뒤 오래 열린 화면이 예전 열로 저장하면 값이 바뀌지 않도록 거절합니다.
    retired_fields = ()

    def to_internal_value(self, data):
        if any(key in data for key in self.retired_fields):
            raise serializers.ValidationError({'non_field_errors': ['데이터 열이 변경되었습니다. 화면을 새로고침한 후 다시 편집하세요.']})
        return super().to_internal_value(data)

    id = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        validators = []


def month_field():
    """기준 월(period_month)을 `YYYY-MM`으로 보여 주는 읽기 전용 열. 저장할 월은 요청의 month로 정합니다."""
    return serializers.DateField(source='period_month', format='%Y-%m', read_only=True)


class ChangeLogSerializer(serializers.ModelSerializer):
    month = month_field()

    class Meta:
        model = ChangeLog
        fields = ['id', 'section', 'month', 'action', 'actor_name', 'summary', 'before_data', 'after_data', 'created_at']
