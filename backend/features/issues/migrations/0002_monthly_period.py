"""리전 이슈를 월별로 저장합니다.

- 기준 월(period_month, 그 달 1일) 열을 더하고 기존 이슈는 2026-11월로 둡니다(값 이전).
- 이슈는 등록한 월에만 속하며, 댓글은 이슈의 월을 따르므로 댓글 테이블은 바꾸지 않습니다.
실행 전 로컬 DB를 .artifacts/backups/에 백업합니다(AGENTS.md).
"""
import datetime

import reporting.months
from django.db import migrations, models
from django.db.models import Q

EXISTING_ROWS_MONTH = datetime.date(2026, 11, 1)


class Migration(migrations.Migration):

    dependencies = [
        ('issues', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='regionalissue',
            name='period_month',
            field=models.DateField(db_comment='기준 월(그 달 1일)', db_index=True, default=EXISTING_ROWS_MONTH),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='regionalissue',
            name='period_month',
            field=models.DateField(db_comment='기준 월(그 달 1일)', db_index=True, default=reporting.months.current_month),
        ),
        migrations.AddConstraint(
            model_name='regionalissue',
            constraint=models.CheckConstraint(condition=Q(period_month__day=1), name='issue_month_first_day'),
        ),
        migrations.AlterModelOptions(name='regionalissue', options={'ordering': ['-period_month', '-updated_at', '-id']}),
        migrations.AlterModelTableComment(name='regionalissue', table_comment='월별 리전 운영 이슈·조치 (등록한 기준 월에 속함)'),
    ]
