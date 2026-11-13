"""운영 인력에 PC IP·오토에버 계정·Z 계정을 더하고 직책·소속사를 비워 둘 수 있게 합니다.

열 추가와 빈 값 허용만 하므로 기존 데이터는 바뀌지 않습니다.
"""
from django.db import migrations, models


def text(max_length, comment=None):
    extra = {'db_comment': comment} if comment else {}
    return models.CharField(blank=True, db_default='', default='', max_length=max_length, **extra)


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0001_initial'),
    ]

    operations = [
        migrations.AddField(model_name='staffassignment', name='pc_ip', field=text(45, 'PC IP')),
        migrations.AddField(model_name='staffassignment', name='autoever_account', field=text(40, '오토에버 계정')),
        migrations.AddField(model_name='staffassignment', name='z_account', field=text(40, 'Z 계정')),
        migrations.AlterField(model_name='staffassignment', name='job_title', field=text(100)),
        migrations.AlterField(model_name='staffassignment', name='company_name', field=text(100)),
    ]
