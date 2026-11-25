from django.db import migrations, models


def enable_empty_columns(apps, schema_editor):
    columns = apps.get_model('staff', 'StaffColumn').objects.using(schema_editor.connection.alias)
    choices = apps.get_model('staff', 'StaffChoice').objects.using(schema_editor.connection.alias)
    columns.exclude(pk__in=choices.values('column_id')).update(allow_free_text=True)


class Migration(migrations.Migration):
    dependencies = [('staff', '0012_stafftablelayout')]
    operations = [
        migrations.AddField(
            model_name='staffcolumn',
            name='allow_free_text',
            field=models.BooleanField(default=False, db_default=False),
        ),
        migrations.RunPython(enable_empty_columns, migrations.RunPython.noop),
    ]
