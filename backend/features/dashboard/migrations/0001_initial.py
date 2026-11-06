"""core 앱에 있던 대시보드 패널 모델을 이 앱으로 옮깁니다.

테이블과 데이터는 그대로 두고 Django가 기억하는 모델 위치(상태)만 바꿉니다. DB는 변경하지 않습니다.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0004_move_board_dashboard_models'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='DashboardPanel',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('title', models.CharField(max_length=100)),
                        ('description', models.CharField(blank=True, default='', max_length=300)),
                        ('viz_type', models.CharField(choices=[('stat', '숫자'), ('timeseries', '시계열'), ('bar', '막대'), ('gauge', '게이지'), ('table', '표')], default='timeseries', max_length=20)),
                        ('source', models.CharField(choices=[('manual', '직접 입력'), ('function', '함수식')], default='manual', max_length=10)),
                        ('values', models.JSONField(blank=True, default=list)),
                        ('func_expr', models.CharField(blank=True, default='', max_length=200)),
                        ('func_from', models.FloatField(default=0)),
                        ('func_to', models.FloatField(default=10)),
                        ('func_step', models.FloatField(default=1)),
                        ('formula', models.CharField(blank=True, default='', max_length=200)),
                        ('options', models.JSONField(blank=True, default=dict)),
                        ('width', models.PositiveSmallIntegerField(default=12)),
                        ('height', models.PositiveSmallIntegerField(default=8)),
                        ('position', models.IntegerField(default=0)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dashboard_panels', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'core_dashboardpanel',
                        'ordering': ['position', 'id'],
                    },
                ),
    
            ],
            database_operations=[],
        ),
    ]
