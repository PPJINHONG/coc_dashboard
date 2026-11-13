from rest_framework import serializers

from core.roles import staff_edit_countries
from reporting.serializers import RowSerializer

from .models import StaffAssignment


EDIT_FIELDS = ['country_code', 'job_title', 'company_name', 'job_description', 'work_location', 'pc_ip', 'autoever_account', 'z_account']


class StaffSerializer(RowSerializer):
    """DB 관리 일괄 저장과 조회 응답. can_edit는 조회한 사용자가 운영 인력 탭에서 이 행을 편집할 수 있는지입니다."""

    retired_fields = ('region', 'role', 'status', 'work_mode', 'remarks')

    staff_name = serializers.CharField(source='staff.staff_name', read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'country_code', 'staff', 'staff_name', 'job_title', 'company_name', 'job_description', 'work_location',
                  'pc_ip', 'autoever_account', 'z_account', 'can_edit']

    def get_can_edit(self, obj):
        request = self.context.get('request')
        return bool(request and obj.country_code in staff_edit_countries(request.user))


class StaffEditSerializer(RowSerializer):
    """운영 인력 탭 편집. 성명은 공통데이터(인력)를 고르지 않고 이름으로 입력합니다."""

    retired_fields = ('region', 'role', 'status', 'work_mode', 'remarks', 'staff')
    staff_name = serializers.CharField(max_length=100, trim_whitespace=True)

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'staff_name', *EDIT_FIELDS]
