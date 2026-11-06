from rest_framework import serializers

from reporting.serializers import RowSerializer

from .models import StaffAssignment


class StaffSerializer(RowSerializer):
    retired_fields = ('region', 'role', 'status', 'work_mode', 'remarks')

    staff_name = serializers.CharField(source='staff.staff_name', read_only=True)

    class Meta(RowSerializer.Meta):
        model = StaffAssignment
        fields = ['id', 'country_code', 'staff', 'staff_name', 'job_title', 'company_name', 'job_description', 'work_location']
