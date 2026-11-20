"""운영 작업 기능과 원본 테이블을 제거합니다.

기존 화면 설정에 남은 운영 작업 탭 ID도 함께 정리합니다.
실행 전 로컬 DB를 .artifacts/backups/에 백업합니다(AGENTS.md).
"""
from django.db import migrations


def remove_hidden_work_tab(apps, schema_editor):
    NavigationPreference = apps.get_model("reporting", "NavigationPreference")
    for preference in NavigationPreference.objects.all().iterator():
        hidden_tabs = preference.hidden_tabs
        if not isinstance(hidden_tabs, list) or "work" not in hidden_tabs:
            continue
        preference.hidden_tabs = [tab for tab in hidden_tabs if tab != "work"]
        preference.save(update_fields=["hidden_tabs"])


class Migration(migrations.Migration):
    dependencies = [
        ("work", "0002_monthly_period"),
    ]

    operations = [
        migrations.RunPython(remove_hidden_work_tab, migrations.RunPython.noop),
        migrations.DeleteModel(name="WorkSummary"),
    ]
