from django.db import migrations, models


def rename_column(table, old, new):
    # 신규 init은 이미 새 열을 사용하고, 기존 설치만 값을 보존하여 이름을 바꿉니다.
    return f'''DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' AND column_name='{old}') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' AND column_name='{new}') THEN
          RAISE EXCEPTION 'Both old and new columns exist in {table}: {old}, {new}';
        END IF;
        ALTER TABLE "{table}" RENAME COLUMN "{old}" TO "{new}";
      END IF;
    END $$;'''


SQL = '\n'.join([
    rename_column('infra_resources', 'zone_name', 'environment_name'),
    rename_column('infra_resources', 'storage_rack_count', 'storage_count'),
    rename_column('ops_staff_assignments', 'role', 'job_title'),
    'ALTER TABLE ops_regions DROP COLUMN IF EXISTS display_order;',
    'ALTER TABLE ops_staff_assignments DROP CONSTRAINT IF EXISTS current_staff_valid_status;',
    'ALTER TABLE ops_staff_assignments DROP CONSTRAINT IF EXISTS current_staff_valid_work_mode;',
    'ALTER TABLE ops_staff_assignments DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS work_mode, DROP COLUMN IF EXISTS remarks;',
    "ALTER TABLE ops_staff_assignments ADD COLUMN IF NOT EXISTS job_description text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS work_location varchar(150) NOT NULL DEFAULT '';",
    'ALTER TABLE infra_resources DROP CONSTRAINT IF EXISTS unique_current_resource_zone;',
    '''DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='infra_resources'::regclass AND conname='unique_current_resource_environment') THEN
        ALTER TABLE infra_resources ADD CONSTRAINT unique_current_resource_environment UNIQUE(region_code, service_code, environment_name);
      END IF;
    END $$;''',
    "COMMENT ON TABLE infra_resources IS '현재 인프라 자원: 리전·서비스·환경별 Host·VM·Storage 수량';",
    "COMMENT ON COLUMN infra_resources.environment_name IS '환경';",
    "COMMENT ON COLUMN infra_resources.storage_count IS 'Storage 수량';",
    "COMMENT ON COLUMN ops_staff_assignments.job_title IS '직책';",
    "COMMENT ON COLUMN ops_staff_assignments.job_description IS '업무';",
    "COMMENT ON COLUMN ops_staff_assignments.work_location IS '근무지';",
])


class Migration(migrations.Migration):
    dependencies = [('reporting', '0010_navigation_preferences')]
    operations = [migrations.SeparateDatabaseAndState(
        database_operations=[migrations.RunSQL(SQL, reverse_sql=None)],
        state_operations=[
            migrations.AlterModelOptions(name='region', options={'ordering': ['region_code']}),
            migrations.AlterModelOptions(name='infrastructureresource', options={'ordering': ['region_id', 'service_id', 'environment_name', 'id']}),
            migrations.AlterModelOptions(name='staffassignment', options={'ordering': ['region_id', 'staff__staff_name', 'id']}),
            migrations.AlterModelOptions(name='worksummary', options={'ordering': ['work_type', 'region_id', 'scope', 'id']}),
            migrations.RemoveField(model_name='region', name='display_order'),
            migrations.RemoveConstraint(model_name='infrastructureresource', name='unique_current_resource_zone'),
            migrations.RenameField(model_name='infrastructureresource', old_name='zone_name', new_name='environment_name'),
            migrations.RenameField(model_name='infrastructureresource', old_name='storage_rack_count', new_name='storage_count'),
            migrations.AddConstraint(model_name='infrastructureresource', constraint=models.UniqueConstraint(fields=('region', 'service', 'environment_name'), name='unique_current_resource_environment')),
            migrations.RemoveConstraint(model_name='staffassignment', name='current_staff_valid_status'),
            migrations.RemoveConstraint(model_name='staffassignment', name='current_staff_valid_work_mode'),
            migrations.RenameField(model_name='staffassignment', old_name='role', new_name='job_title'),
            migrations.RemoveField(model_name='staffassignment', name='status'),
            migrations.RemoveField(model_name='staffassignment', name='work_mode'),
            migrations.RemoveField(model_name='staffassignment', name='remarks'),
            migrations.AddField(model_name='staffassignment', name='job_description', field=models.TextField(blank=True, default='', db_default='')),
            migrations.AddField(model_name='staffassignment', name='work_location', field=models.CharField(blank=True, default='', db_default='', max_length=150)),
            migrations.AlterModelTableComment(name='infrastructureresource', table_comment='현재 인프라 자원: 리전·서비스·환경별 Host·VM·Storage 수량'),
        ],
    )]
