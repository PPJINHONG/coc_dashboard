from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('reporting', '0012_staff_country')]
    operations = [migrations.SeparateDatabaseAndState(
        # Fresh init already omits the code; existing IDs and foreign keys are retained.
        database_operations=[migrations.RunSQL('ALTER TABLE ops_staff_members DROP COLUMN IF EXISTS staff_code;')],
        state_operations=[migrations.RemoveField(model_name='staffmember', name='staff_code')],
    )]
