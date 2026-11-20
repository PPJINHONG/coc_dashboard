from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0008_work_hours_in_kst'),
    ]

    operations = [
        migrations.CreateModel(
            name='StaffHeadcountRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period_month', models.DateField(db_comment='기준 월 (그 달 1일)')),
                ('country_code', models.CharField(choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')], max_length=2)),
                ('headcount', models.PositiveIntegerField(db_comment='그 달 말 운영 인원')),
                ('entries', models.PositiveIntegerField(db_comment='그 달 투입 인원', db_default=0, default=0)),
                ('exits', models.PositiveIntegerField(db_comment='그 달 퇴사 인원', db_default=0, default=0)),
            ],
            options={
                'db_table': 'ops_staff_headcount_records',
                'db_table_comment': '월별 권역 운영 인원 기록',
                'ordering': ['period_month', 'country_code'],
                'constraints': [
                    models.UniqueConstraint(fields=('period_month', 'country_code'), name='unique_staff_headcount_month_country'),
                    models.CheckConstraint(condition=models.Q(country_code__in=['KR', 'EU', 'NA']), name='staff_headcount_valid_country'),
                ],
            },
        ),
    ]
