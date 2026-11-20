from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0006_calendar_kinds_leave_marriage'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffresponsibility',
            name='work_start',
            field=models.TimeField(blank=True, db_comment='권역 현지 출근 시간', null=True),
        ),
        migrations.AddField(
            model_name='staffresponsibility',
            name='work_end',
            field=models.TimeField(blank=True, db_comment='권역 현지 퇴근 시간', null=True),
        ),
    ]
