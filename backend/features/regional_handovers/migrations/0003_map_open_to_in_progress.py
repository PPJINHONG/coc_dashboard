from django.db import migrations


def map_open_to_in_progress(apps, schema_editor):
    Handover = apps.get_model("regional_handovers", "RegionalHandover")
    ChangeLog = apps.get_model("reporting", "ChangeLog")
    Handover.objects.filter(status="open").update(status="in_progress")
    # 제거된 상태를 포함한 과거 원본은 조회만 유지하고 자동 복구 대상에서 제외합니다.
    ChangeLog.objects.filter(section="regional_handovers").update(restore_data={})


class Migration(migrations.Migration):
    dependencies = [
        ("regional_handovers", "0002_remove_regionalhandover_regional_handover_valid_priority_and_more"),
        ("reporting", "0021_delete_service"),
    ]

    operations = [
        migrations.RunPython(map_open_to_in_progress, migrations.RunPython.noop),
    ]
