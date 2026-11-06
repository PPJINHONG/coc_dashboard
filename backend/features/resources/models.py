from django.db import models

from reporting.models import CurrentRow, Service


class InfrastructureResource(CurrentRow):
    service = models.ForeignKey(Service, db_column='service_code', on_delete=models.PROTECT)
    host_count = models.PositiveIntegerField(default=0, db_default=0)
    vm_count = models.PositiveIntegerField(null=True, blank=True)
    compute_rack_count = models.PositiveIntegerField(null=True, blank=True)
    storage_count = models.PositiveIntegerField(null=True, blank=True)  # Storage Rack 수량
    remarks = models.TextField(blank=True, default='', db_default='')

    class Meta:
        db_table = 'infra_resources'
        db_table_comment = '현재 인프라 자원: 리전·서비스별 Host·VM·Compute Rack·Storage Rack 수량'
        ordering = ['region_id', 'service_id', 'id']
        constraints = [models.UniqueConstraint(fields=['region', 'service'], name='unique_current_resource_service')]
