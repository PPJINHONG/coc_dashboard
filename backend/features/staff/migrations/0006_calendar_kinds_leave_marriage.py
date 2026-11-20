from django.db import migrations, models


def merge_long_leave(apps, schema_editor):
    # 장기휴가는 더 이상 쓰지 않으므로 기존 일정은 연차(leave)로 옮깁니다.
    apps.get_model('staff', 'StaffCalendarEvent').objects.filter(kind='long_leave').update(kind='leave')


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0005_dynamic_items_and_columns'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='staffcalendarevent', name='staff_calendar_valid_kind'),
        migrations.RunPython(merge_long_leave, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='staffcalendarevent',
            name='kind',
            field=models.CharField(choices=[('leave', '연차'), ('marriage_leave', '결혼휴가')], max_length=20),
        ),
        migrations.AddConstraint(
            model_name='staffcalendarevent',
            constraint=models.CheckConstraint(condition=models.Q(kind__in=['leave', 'marriage_leave']), name='staff_calendar_valid_kind_v2'),
        ),
    ]
