from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('reporting', '0006_remove_legacy_visibility')]
    operations = [
        # 최신 init SQL에는 이 열이 없습니다. 기존 설치에서만 열과 값을 제거합니다.
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL('ALTER TABLE "infra_resources" DROP COLUMN IF EXISTS "compute_rack_count";', reverse_sql=None)],
            state_operations=[migrations.RemoveField(model_name='infrastructureresource', name='compute_rack_count')],
        ),
    ]
