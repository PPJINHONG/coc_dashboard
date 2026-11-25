from datetime import date

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


MIGRATE_FROM = [("resources", "0003_alter_infrastructureresource_options_and_more")]
MIGRATE_TO = [("resources", "0005_alter_infrastructureresource_table_comment_and_more")]


@pytest.mark.django_db(transaction=True)
def test_service_migration_merges_rows_and_preserves_quantity_totals():
    executor = MigrationExecutor(connection)
    executor.migrate(MIGRATE_FROM)
    old_apps = executor.loader.project_state(MIGRATE_FROM).apps
    Region = old_apps.get_model("reporting", "Region")
    Resource = old_apps.get_model("resources", "InfrastructureResource")
    ChangeLog = old_apps.get_model("reporting", "ChangeLog")
    region = Region.objects.create(region_name="통합 테스트", country_code="KR")
    common = {"period_month": date(2026, 11, 1), "region_id": region.pk}
    Resource.objects.create(**common, service="Compute Platform", host_count=10, vm_count=20, compute_rack_count=1, storage_count=None, remarks="실사")
    Resource.objects.create(**common, service="Virtualization", host_count=5, vm_count=None, compute_rack_count=2, storage_count=3, remarks="실사")
    Resource.objects.create(**common, service="Database Platform", host_count=7, vm_count=8, compute_rack_count=1, storage_count=1, remarks="DB")
    Resource.objects.create(**common, service="Storage & Backup", host_count=3, vm_count=2, compute_rack_count=None, storage_count=4, remarks="백업")
    log = ChangeLog.objects.create(
        section="resources",
        action="update",
        actor_name="테스트",
        summary="서비스 통합 전 기록",
        restore_data={"changes": [{"model": "resources.infrastructureresource"}]},
    )

    executor = MigrationExecutor(connection)
    executor.migrate(MIGRATE_TO)
    new_apps = executor.loader.project_state(MIGRATE_TO).apps
    Resource = new_apps.get_model("resources", "InfrastructureResource")
    ChangeLog = new_apps.get_model("reporting", "ChangeLog")
    rows = {row.service: row for row in Resource.objects.order_by("service")}

    assert set(rows) == {"HCLOUD", "CCS"}
    assert (rows["HCLOUD"].host_count, rows["HCLOUD"].vm_count) == (15, 20)
    assert (rows["HCLOUD"].compute_rack_count, rows["HCLOUD"].storage_count) == (3, 3)
    assert (rows["CCS"].host_count, rows["CCS"].vm_count) == (10, 10)
    assert (rows["CCS"].compute_rack_count, rows["CCS"].storage_count) == (1, 5)
    assert rows["CCS"].remarks == "DB · 백업"
    assert ChangeLog.objects.get(pk=log.pk).restore_data == {}

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, "infra_resources")
    assert constraints["resource_valid_service"]["check"] is True
