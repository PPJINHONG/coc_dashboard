from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('reporting', '0008_common_data_labels')]
    operations = [
        # 최신 init에는 사용 상태 열이 없으므로 기존 설치에서만 제거합니다.
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(
                'ALTER TABLE "ops_regions" DROP COLUMN IF EXISTS "is_active"; '
                'ALTER TABLE "ops_services" DROP COLUMN IF EXISTS "is_active"; '
                'ALTER TABLE "ops_staff_members" DROP COLUMN IF EXISTS "is_active";',
                reverse_sql=None,
            )],
            state_operations=[
                migrations.RemoveField(model_name='region', name='is_active'),
                migrations.RemoveField(model_name='service', name='is_active'),
                migrations.RemoveField(model_name='staffmember', name='is_active'),
            ],
        ),
    ]
