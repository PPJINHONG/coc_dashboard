from django.db import migrations, models


SQL = """
ALTER TABLE ops_staff_assignments ADD COLUMN IF NOT EXISTS country_code varchar(2);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ops_staff_assignments' AND column_name='region_code'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM ops_staff_assignments a
      LEFT JOIN ops_regions r ON r.region_code=a.region_code
      WHERE r.country_code IS NULL OR r.country_code NOT IN ('KR', 'EU', 'NA')
    ) THEN
      RAISE EXCEPTION 'Staff countries must be mapped to KR, EU or NA before migration';
    END IF;
    UPDATE ops_staff_assignments a SET country_code=r.country_code
      FROM ops_regions r WHERE r.region_code=a.region_code;
    ALTER TABLE ops_staff_assignments DROP COLUMN region_code;
  END IF;
END $$;
ALTER TABLE ops_staff_assignments ALTER COLUMN country_code SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ops_staff_assignments'::regclass AND conname='current_staff_valid_country') THEN
    ALTER TABLE ops_staff_assignments ADD CONSTRAINT current_staff_valid_country CHECK (country_code IN ('KR', 'EU', 'NA'));
  END IF;
END $$;
COMMENT ON COLUMN ops_staff_assignments.country_code IS '운영 인력 국가 (KR·EU·NA)';
"""


class Migration(migrations.Migration):
    dependencies = [('reporting', '0011_environment_storage_staff_columns')]
    operations = [migrations.SeparateDatabaseAndState(
        database_operations=[migrations.RunSQL(SQL)],
        state_operations=[
            migrations.AddField(
                model_name='staffassignment', name='country_code',
                field=models.CharField(max_length=2, choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')]),
            ),
            migrations.RemoveField(model_name='staffassignment', name='region'),
            migrations.AlterModelOptions(name='staffassignment', options={'ordering': ['country_code', 'staff__staff_name', 'id']}),
            migrations.AddConstraint(
                model_name='staffassignment',
                constraint=models.CheckConstraint(condition=models.Q(country_code__in=['KR', 'EU', 'NA']), name='current_staff_valid_country'),
            ),
        ],
    )]
