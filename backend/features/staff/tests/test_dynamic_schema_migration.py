import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

MIGRATE_FROM = [("staff", "0009_staff_headcount_records"), ("reporting", "0021_delete_service")]
MIGRATE_TO = [("staff", "0014_staff_dates_and_shared_choices"), ("reporting", "0021_delete_service")]


@pytest.mark.django_db(transaction=True)
def test_dynamic_staff_migration_removes_fixed_items_and_clears_old_catalog():
    executor = MigrationExecutor(connection)
    executor.migrate(MIGRATE_FROM)
    old = executor.loader.project_state(MIGRATE_FROM).apps
    Member = old.get_model("reporting", "StaffMember")
    Assignment = old.get_model("staff", "StaffAssignment")
    Column = old.get_model("staff", "StaffColumn")
    Choice = old.get_model("staff", "StaffChoice")
    ChangeLog = old.get_model("reporting", "ChangeLog")
    member = Member.objects.create(staff_name="기존 인력")
    column = Column.objects.create(label="기존 추가 열")
    Assignment.objects.create(
        staff_id=member.pk,
        country_code="KR",
        job_title="팀원",
        company_name="기존 회사",
        work_location="상암",
        grade="L2",
        custom_values={column.key: "기존 값"},
    )
    Choice.objects.create(kind="company_name", country_code="", value="기존 회사")
    Choice.objects.create(kind=column.key, column_id=column.pk, country_code="", value="기존 값")
    log = ChangeLog.objects.create(section="staff", action="update", actor_name="테스트", summary="이전 항목", restore_data={"changes": [{}]})

    executor = MigrationExecutor(connection)
    executor.migrate(MIGRATE_TO)
    new = executor.loader.project_state(MIGRATE_TO).apps
    Assignment = new.get_model("staff", "StaffAssignment")
    Column = new.get_model("staff", "StaffColumn")
    Choice = new.get_model("staff", "StaffChoice")
    ChangeLog = new.get_model("reporting", "ChangeLog")
    row = Assignment.objects.get()
    assert row.job_title == "책임" and row.custom_values == {}
    assert not Column.objects.exists() and not Choice.objects.exists()
    assert ChangeLog.objects.get(pk=log.pk).restore_data == {}
    with connection.cursor() as cursor:
        names = {field.name for field in connection.introspection.get_table_description(cursor, "ops_staff_assignments")}
    assert not {"company_name", "work_location", "grade"} & names
