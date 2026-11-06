"""reporting 앱에 있던 운영 작업 모델을 이 앱으로 옮깁니다.

테이블과 데이터는 그대로 두고 Django가 기억하는 모델 위치(상태)만 바꿉니다. DB는 변경하지 않습니다.
"""
import django.db.models.deletion
import django.db.models.expressions
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
                    name='WorkSummary',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('updated_at', models.DateTimeField(auto_now=True, db_default=django.db.models.functions.datetime.Now())),
                        ('work_type', models.CharField(choices=[('request', '요청작업'), ('change', '변경작업'), ('incident', '장애대응')], max_length=10)),
                        ('scope', models.CharField(choices=[('infra', '인프라'), ('automation', '자동화')], db_default='infra', default='infra', max_length=15)),
                        ('total_count', models.PositiveIntegerField(db_default=0, default=0)),
                        ('completed_count', models.PositiveIntegerField(db_default=0, default=0)),
                        ('batch_count', models.PositiveIntegerField(db_default=0, default=0)),
                        ('delayed_count', models.PositiveIntegerField(db_default=0, default=0)),
                        ('mttr_minutes', models.DecimalField(blank=True, decimal_places=1, max_digits=8, null=True)),
                        ('remarks', models.TextField(blank=True, db_default='', default='')),
                        ('region', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='reporting.region')),
                    ],
                    options={
                        'db_table': 'ops_work_summaries',
                        'db_table_comment': '현재 요청·변경·장애 작업 현황',
                        'ordering': ['work_type', 'region_id', 'scope', 'id'],
                        'constraints': [models.UniqueConstraint(fields=('region', 'work_type', 'scope'), name='unique_current_work_scope'), models.CheckConstraint(condition=models.Q(('work_type__in', ['request', 'change', 'incident'])), name='current_work_valid_type'), models.CheckConstraint(condition=models.Q(('scope__in', ['infra', 'automation'])), name='current_work_valid_scope'), models.CheckConstraint(condition=models.Q(('completed_count__lte', models.F('total_count'))), name='work_completed_lte_total'), models.CheckConstraint(condition=models.Q(('batch_count__lte', models.F('total_count'))), name='work_batch_lte_total'), models.CheckConstraint(condition=models.Q(('delayed_count__lte', django.db.models.expressions.CombinedExpression(models.F('total_count'), '-', models.F('completed_count')))), name='work_delayed_lte_remaining'), models.CheckConstraint(condition=models.Q(('mttr_minutes__isnull', True), ('mttr_minutes__gte', 0), _connector='OR'), name='work_mttr_nonnegative')],
                    },
                ),
    
            ],
            database_operations=[],
        ),
    ]
