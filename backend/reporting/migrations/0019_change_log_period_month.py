"""운영 변경 이력에 기준 월(period_month)을 더합니다.

월별 기능(인프라 자원·운영 작업·리전 이슈) 변경에만 값이 들어가며, 기존 이력과 공통데이터 변경은 비워 둡니다.
열 추가만 하므로 기존 데이터는 바뀌지 않습니다.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reporting', '0018_move_feature_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='changelog',
            name='period_month',
            field=models.DateField(blank=True, db_comment='변경한 데이터의 기준 월(그 달 1일)', db_index=True, null=True),
        ),
    ]
