"""reporting 앱에 있던 운영 인력 배치 모델을 이 앱으로 옮깁니다.

테이블과 데이터는 그대로 두고 Django가 기억하는 모델 위치(상태)만 바꿉니다. DB는 변경하지 않습니다.
"""
import django.db.models.deletion
import django.db.models.functions.datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('reporting', '0018_move_feature_models'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='StaffAssignment',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('country_code', models.CharField(choices=[('KR', 'KR'), ('EU', 'EU'), ('NA', 'NA')], max_length=2)),
                        ('updated_at', models.DateTimeField(auto_now=True, db_default=django.db.models.functions.datetime.Now())),
                        ('job_title', models.CharField(max_length=100)),
                        ('company_name', models.CharField(max_length=100)),
                        ('job_description', models.TextField(blank=True, db_default='', default='')),
                        ('work_location', models.CharField(blank=True, db_default='', default='', max_length=150)),
                        ('staff', models.ForeignKey(db_column='staff_member_id', on_delete=django.db.models.deletion.PROTECT, to='reporting.staffmember')),
                    ],
                    options={
                        'db_table': 'ops_staff_assignments',
                        'db_table_comment': '현재 운영 인력 배치',
                        'ordering': ['country_code', 'staff__staff_name', 'id'],
                        'constraints': [models.UniqueConstraint(fields=('staff',), name='unique_current_staff_assignment'), models.CheckConstraint(condition=models.Q(('country_code__in', ['KR', 'EU', 'NA'])), name='current_staff_valid_country')],
                    },
                ),
    
            ],
            database_operations=[],
        ),
    ]
