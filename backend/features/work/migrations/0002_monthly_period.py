"""운영 작업을 월별로 저장합니다.

- 기준 월(period_month, 그 달 1일) 열을 더하고 기존 행은 2026-11월로 둡니다(값 이전).
- 고유 조합을 리전·작업유형·범위에서 기준 월·리전·작업유형·범위로 바꿉니다.
실행 전 로컬 DB를 .artifacts/backups/에 백업합니다(AGENTS.md).
"""
import datetime

import reporting.months
from django.db import migrations, models
from django.db.models import Q

EXISTING_ROWS_MONTH = datetime.date(2026, 11, 1)


class Migration(migrations.Migration):

    dependencies = [
        ('work', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='worksummary',
            name='period_month',
            field=models.DateField(db_comment='기준 월(그 달 1일)', db_index=True, default=EXISTING_ROWS_MONTH),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='worksummary',
            name='period_month',
            field=models.DateField(db_comment='기준 월(그 달 1일)', db_index=True, default=reporting.months.current_month),
        ),
        migrations.RemoveConstraint(model_name='worksummary', name='unique_current_work_scope'),
        migrations.AddConstraint(
            model_name='worksummary',
            constraint=models.UniqueConstraint(fields=('period_month', 'region', 'work_type', 'scope'), name='unique_monthly_work_scope'),
        ),
        migrations.AddConstraint(
            model_name='worksummary',
            constraint=models.CheckConstraint(condition=Q(period_month__day=1), name='work_month_first_day'),
        ),
        migrations.AlterModelOptions(name='worksummary', options={'ordering': ['-period_month', 'work_type', 'region_id', 'scope', 'id']}),
        migrations.AlterModelTableComment(name='worksummary', table_comment='월별 요청·변경·장애 작업 현황'),
    ]
