"""reporting 앱에 있던 인프라 자원 모델을 이 앱으로 옮깁니다.

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
                    name='InfrastructureResource',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('updated_at', models.DateTimeField(auto_now=True, db_default=django.db.models.functions.datetime.Now())),
                        ('host_count', models.PositiveIntegerField(db_default=0, default=0)),
                        ('vm_count', models.PositiveIntegerField(blank=True, null=True)),
                        ('compute_rack_count', models.PositiveIntegerField(blank=True, null=True)),
                        ('storage_count', models.PositiveIntegerField(blank=True, null=True)),
                        ('remarks', models.TextField(blank=True, db_default='', default='')),
                        ('region', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='reporting.region')),
                        ('service', models.ForeignKey(db_column='service_code', on_delete=django.db.models.deletion.PROTECT, to='reporting.service')),
                    ],
                    options={
                        'db_table': 'infra_resources',
                        'db_table_comment': '현재 인프라 자원: 리전·서비스별 Host·VM·Compute Rack·Storage Rack 수량',
                        'ordering': ['region_id', 'service_id', 'id'],
                        'constraints': [models.UniqueConstraint(fields=('region', 'service'), name='unique_current_resource_service')],
                    },
                ),
    
            ],
            database_operations=[],
        ),
    ]
