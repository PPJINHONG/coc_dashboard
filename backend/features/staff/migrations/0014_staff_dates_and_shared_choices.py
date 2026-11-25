from django.db import migrations, models


def merge_regional_choices(apps, schema_editor):
    choices = apps.get_model('staff', 'StaffChoice').objects.using(schema_editor.connection.alias)
    duplicates = (choices.values('kind', 'value').annotate(count=models.Count('pk'), keep=models.Min('pk'))
                  .filter(count__gt=1).order_by())
    for group in list(duplicates):
        choices.filter(kind=group['kind'], value=group['value']).exclude(pk=group['keep']).delete()


class Migration(migrations.Migration):
    dependencies = [('staff', '0013_staffcolumn_allow_free_text')]
    operations = [
        migrations.AddField('staffassignment', 'hire_date', models.DateField(blank=True, null=True, db_comment='입사일')),
        migrations.AddField('staffassignment', 'assignment_end_date', models.DateField(blank=True, null=True, db_comment='업무 종료일')),
        migrations.AddField('stafftablelayout', 'date_positions', models.JSONField(default=dict, blank=True, db_default={})),
        migrations.RunPython(merge_regional_choices, migrations.RunPython.noop),
        migrations.RemoveConstraint('staffchoice', 'unique_staff_choice'),
        migrations.RemoveConstraint('staffchoice', 'staff_choice_valid_country'),
        migrations.AlterModelOptions('staffchoice', {'ordering': ['kind', 'value', 'id']}),
        migrations.RemoveField('staffchoice', 'country_code'),
        migrations.RemoveField('staffcolumn', 'is_region_scoped'),
        migrations.AddConstraint('staffchoice', models.UniqueConstraint(fields=['kind', 'value'], name='unique_staff_shared_choice')),
    ]
