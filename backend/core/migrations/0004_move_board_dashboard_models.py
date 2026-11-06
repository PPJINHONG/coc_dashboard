"""게시판·대시보드 모델을 기능 앱(features/board·dashboard)으로 옮깁니다.

테이블과 데이터는 그대로 두고 Django가 기억하는 모델 위치(상태)만 바꿉니다. DB는 변경하지 않습니다.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_useractivity'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='dashboardpanel',
                    name='owner',
                ),
                migrations.RemoveField(
                    model_name='post',
                    name='author',
                ),
                migrations.RemoveField(
                    model_name='postimage',
                    name='post',
                ),
                migrations.RemoveField(
                    model_name='postimage',
                    name='uploader',
                ),
                migrations.DeleteModel(
                    name='Comment',
                ),
                migrations.DeleteModel(
                    name='DashboardPanel',
                ),
                migrations.DeleteModel(
                    name='Post',
                ),
                migrations.DeleteModel(
                    name='PostImage',
                ),
    
            ],
            database_operations=[],
        ),
    ]
