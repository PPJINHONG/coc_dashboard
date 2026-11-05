from django.db import migrations, models
from django.db.models import Case, Value, When


SQL = """
ALTER TABLE infra_resources ADD COLUMN IF NOT EXISTS compute_rack_count integer NULL CHECK (compute_rack_count >= 0);
COMMENT ON COLUMN infra_resources.compute_rack_count IS 'Compute Rack 수량';
COMMENT ON COLUMN infra_resources.storage_count IS 'Storage Rack 수량';
COMMENT ON TABLE infra_resources IS '현재 인프라 자원: 리전·서비스·환경별 Host·VM·Compute Rack·Storage Rack 수량';
ALTER TABLE ops_regions ADD COLUMN IF NOT EXISTS global_region varchar(10) GENERATED ALWAYS AS (
  CASE WHEN country_code IN ('KR', 'CN') THEN '내수' WHEN country_code = 'EU' THEN '유럽' WHEN country_code = 'NA' THEN '북미' END
) STORED;
COMMENT ON COLUMN ops_regions.global_region IS '전체 리전 (KR·CN=내수, EU=유럽, NA=북미, 그 외 빈 값)';
"""


class Migration(migrations.Migration):
    dependencies = [('reporting', '0015_issue_author')]
    operations = [migrations.SeparateDatabaseAndState(
        # 신규 설치는 init SQL에 이미 열이 있으므로 IF NOT EXISTS로 양쪽을 맞춥니다.
        # 0007이 신규 설치에서도 compute_rack_count를 지우므로 여기서 다시 빈 열로 추가됩니다.
        database_operations=[migrations.RunSQL(SQL, reverse_sql=None)],
        state_operations=[
            migrations.AddField(model_name='infrastructureresource', name='compute_rack_count', field=models.PositiveIntegerField(blank=True, null=True)),
            migrations.AlterModelTableComment(name='infrastructureresource', table_comment='현재 인프라 자원: 리전·서비스·환경별 Host·VM·Compute Rack·Storage Rack 수량'),
            migrations.AddField(
                model_name='region',
                name='global_region',
                field=models.GeneratedField(
                    db_persist=True,
                    expression=Case(
                        When(country_code__in=['KR', 'CN'], then=Value('내수')),
                        When(country_code='EU', then=Value('유럽')),
                        When(country_code='NA', then=Value('북미')),
                        default=None,
                    ),
                    output_field=models.CharField(max_length=10, null=True),
                ),
            ),
        ],
    )]
