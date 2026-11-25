from django.db import migrations


def clear_fixed_staff_items(apps, schema_editor):
    StaffAssignment = apps.get_model("staff", "StaffAssignment")
    StaffChoice = apps.get_model("staff", "StaffChoice")
    StaffColumn = apps.get_model("staff", "StaffColumn")
    ChangeLog = apps.get_model("reporting", "ChangeLog")

    StaffChoice.objects.all().delete()
    StaffColumn.objects.all().delete()
    StaffAssignment.objects.update(custom_values={})
    StaffAssignment.objects.filter(job_title__in=["", "팀원"]).update(job_title="책임")
    # 제거되는 고정 열과 과거 동적 열을 포함한 원본은 조회만 유지합니다.
    ChangeLog.objects.filter(section="staff").update(restore_data={})


class Migration(migrations.Migration):
    dependencies = [
        ("staff", "0009_staff_headcount_records"),
        ("reporting", "0021_delete_service"),
    ]

    operations = [
        migrations.RunPython(clear_fixed_staff_items, migrations.RunPython.noop),
    ]
