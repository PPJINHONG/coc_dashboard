"""인프라 자원·운영 인력·운영 작업·리전 이슈 모델을 기능 앱(features/resources·staff·work·issues)으로 옮깁니다.

테이블과 데이터는 그대로 두고 Django가 기억하는 모델 위치(상태)만 바꿉니다. DB는 변경하지 않습니다.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('reporting', '0017_remove_resource_environment'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='issuecomment',
                    name='issue',
                ),
                migrations.RemoveField(
                    model_name='regionalissue',
                    name='owner',
                ),
                migrations.RemoveField(
                    model_name='regionalissue',
                    name='region',
                ),
                migrations.RemoveField(
                    model_name='staffassignment',
                    name='staff',
                ),
                migrations.RemoveField(
                    model_name='worksummary',
                    name='region',
                ),
                migrations.DeleteModel(
                    name='InfrastructureResource',
                ),
                migrations.DeleteModel(
                    name='IssueComment',
                ),
                migrations.DeleteModel(
                    name='RegionalIssue',
                ),
                migrations.DeleteModel(
                    name='StaffAssignment',
                ),
                migrations.DeleteModel(
                    name='WorkSummary',
                ),
    
            ],
            database_operations=[],
        ),
    ]
