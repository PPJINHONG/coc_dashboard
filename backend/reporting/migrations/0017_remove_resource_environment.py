from django.db import migrations, models


SQL = """
DO $$ BEGIN
  -- 환경을 빼면 리전·서비스가 고유 조합이 됩니다. 겹치는 행이 있으면 값을 지우지 않고 전체를 중단합니다.
  IF EXISTS (SELECT 1 FROM infra_resources GROUP BY region_id, service_code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'infra_resources has duplicate region/service rows; merge them before removing environment_name';
  END IF;
END $$;
ALTER TABLE infra_resources DROP CONSTRAINT IF EXISTS unique_current_resource_environment;
ALTER TABLE infra_resources DROP COLUMN IF EXISTS environment_name;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='infra_resources'::regclass AND conname='unique_current_resource_service') THEN
    ALTER TABLE infra_resources ADD CONSTRAINT unique_current_resource_service UNIQUE (region_id, service_code);
  END IF;
END $$;
COMMENT ON TABLE infra_resources IS '현재 인프라 자원: 리전·서비스별 Host·VM·Compute Rack·Storage Rack 수량';
-- 환경 열이 있던 편집 초안은 버전 충돌로 저장을 막습니다.
UPDATE ops_data_state SET revision=revision+1, updated_at=STATEMENT_TIMESTAMP();
"""


class Migration(migrations.Migration):
    dependencies = [('reporting', '0016_rack_columns_global_region')]
    operations = [migrations.SeparateDatabaseAndState(
        # 신규 설치도 0011이 environment_name을 참조하므로 init에 열을 만든 뒤 여기서 지웁니다.
        database_operations=[migrations.RunSQL(SQL, reverse_sql=None)],
        state_operations=[
            migrations.RemoveConstraint(model_name='infrastructureresource', name='unique_current_resource_environment'),
            migrations.RemoveField(model_name='infrastructureresource', name='environment_name'),
            migrations.AddConstraint(model_name='infrastructureresource', constraint=models.UniqueConstraint(fields=('region', 'service'), name='unique_current_resource_service')),
            migrations.AlterModelOptions(name='infrastructureresource', options={'ordering': ['region_id', 'service_id', 'id']}),
            migrations.AlterModelTableComment(name='infrastructureresource', table_comment='현재 인프라 자원: 리전·서비스별 Host·VM·Compute Rack·Storage Rack 수량'),
        ],
    )]
