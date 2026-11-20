from django.db import migrations, models


class Migration(migrations.Migration):
    """근무 시간을 권역 현지 시각이 아닌 한국 시간(KST) 기준으로 씁니다. 값은 바꾸지 않습니다."""

    dependencies = [
        ('staff', '0007_responsibility_work_hours'),
    ]

    operations = [
        migrations.AlterField(
            model_name='staffresponsibility',
            name='work_start',
            field=models.TimeField(blank=True, db_comment='출근 시간 (KST)', null=True),
        ),
        migrations.AlterField(
            model_name='staffresponsibility',
            name='work_end',
            field=models.TimeField(blank=True, db_comment='퇴근 시간 (KST)', null=True),
        ),
    ]
