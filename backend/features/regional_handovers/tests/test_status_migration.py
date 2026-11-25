import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


MIGRATE_FROM = [
    ("regional_handovers", "0002_remove_regionalhandover_regional_handover_valid_priority_and_more"),
    ("reporting", "0021_delete_service"),
]
MIGRATE_TO = [
    ("regional_handovers", "0004_remove_regionalhandover_regional_handover_valid_status_and_more"),
    ("reporting", "0021_delete_service"),
]


@pytest.mark.django_db(transaction=True)
def test_status_migration_maps_open_and_adds_database_constraint():
    executor = MigrationExecutor(connection)
    executor.migrate(MIGRATE_FROM)
    old_apps = executor.loader.project_state(MIGRATE_FROM).apps
    Handover = old_apps.get_model("regional_handovers", "RegionalHandover")
    ChangeLog = old_apps.get_model("reporting", "ChangeLog")
    row = Handover.objects.create(
        region="KR",
        priority="high",
        status="open",
        category="issue",
        title="이전 상태",
        content_html="<p>내용</p>",
        author_name="테스트",
    )
    log = ChangeLog.objects.create(
        section="regional_handovers",
        action="update",
        actor_name="테스트",
        summary="상태 변경 전 기록",
        restore_data={"changes": [{"model": "regional_handovers.regionalhandover"}]},
    )

    executor = MigrationExecutor(connection)
    executor.migrate(MIGRATE_TO)
    new_apps = executor.loader.project_state(MIGRATE_TO).apps
    Handover = new_apps.get_model("regional_handovers", "RegionalHandover")
    ChangeLog = new_apps.get_model("reporting", "ChangeLog")

    assert Handover.objects.get(pk=row.pk).status == "in_progress"
    assert ChangeLog.objects.get(pk=log.pk).restore_data == {}
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, "ops_regional_handovers")
    assert constraints["regional_handover_valid_status"]["check"] is True
