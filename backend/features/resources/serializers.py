from reporting.serializers import RowSerializer, month_field

from .models import InfrastructureResource


class ResourceSerializer(RowSerializer):
    retired_fields = ('zone_name', 'storage_rack_count', 'environment_name')
    month = month_field()

    class Meta(RowSerializer.Meta):
        model = InfrastructureResource
        fields = ['id', 'month', 'region', 'service', 'host_count', 'vm_count', 'compute_rack_count', 'storage_count', 'remarks', 'updated_at']
        read_only_fields = ['updated_at']
