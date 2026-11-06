from reporting.serializers import RowSerializer

from .models import InfrastructureResource


class ResourceSerializer(RowSerializer):
    retired_fields = ('zone_name', 'storage_rack_count', 'environment_name')

    class Meta(RowSerializer.Meta):
        model = InfrastructureResource
        fields = ['id', 'region', 'service', 'host_count', 'vm_count', 'compute_rack_count', 'storage_count', 'remarks', 'updated_at']
        read_only_fields = ['updated_at']
