"""인프라 자원을 월별로 저장합니다.

- 기준 월(period_month, 그 달 1일) 열을 더하고 기존 행은 2026-11월로 둡니다(값 이전).
- 고유 조합을 리전·서비스에서 기준 월·리전·서비스로 바꿉니다.
실행 전 로컬 DB를 .artifacts/backups/에 백업합니다(AGENTS.md).
"""
import datetime

import reporting.months
from django.db import migrations, models
from django.db.models import Q

EXISTING_ROWS_MONTH = datetime.date(2026, 11, 1)


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='infrastructureresource',
            name='period_month',
            field=models.DateField(db_comment='기준 월(그 달 1일)', db_index=True, default=EXISTING_ROWS_MONTH),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='infrastructureresource',
            name='period_month',
            field=models.DateField(db_comment='기준 월(그 달 1일)', db_index=True, default=reporting.months.current_month),
        ),
        migrations.RemoveConstraint(model_name='infrastructureresource', name='unique_current_resource_service'),
        migrations.AddConstraint(
            model_name='infrastructureresource',
            constraint=models.UniqueConstraint(fields=('period_month', 'region', 'service'), name='unique_monthly_resource_service'),
        ),
        migrations.AddConstraint(
            model_name='infrastructureresource',
            constraint=models.CheckConstraint(condition=Q(period_month__day=1), name='resource_month_first_day'),
        ),
        migrations.AlterModelOptions(name='infrastructureresource', options={'ordering': ['-period_month', 'region_id', 'service_id', 'id']}),
        migrations.AlterModelTableComment(name='infrastructureresource', table_comment='월별 인프라 자원: 기준 월·리전·서비스별 Host·VM·Compute Rack·Storage Rack 수량'),
    ]
