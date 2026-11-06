"""reporting 앱에 있던 리전 이슈·댓글 모델을 이 앱으로 옮깁니다.

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
                    name='RegionalIssue',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('updated_at', models.DateTimeField(auto_now=True, db_default=django.db.models.functions.datetime.Now())),
                        ('title', models.CharField(max_length=200)),
                        ('description', models.TextField(blank=True, db_default='', default='')),
                        ('severity', models.CharField(choices=[('critical', '긴급'), ('major', '높음'), ('minor', '보통'), ('info', '안내')], db_default='minor', default='minor', max_length=10)),
                        ('status', models.CharField(choices=[('open', '진행중'), ('blocked', '보류'), ('resolved', '완료')], db_default='open', default='open', max_length=10)),
                        ('progress_percent', models.PositiveSmallIntegerField(db_default=0, default=0)),
                        ('next_action', models.TextField(blank=True, db_default='', default='')),
                        ('author_name', models.CharField(blank=True, db_default='', default='', max_length=150)),
                        ('author_username', models.CharField(blank=True, db_default='', default='', max_length=150)),
                        ('owner', models.ForeignKey(blank=True, db_column='owner_staff_id', null=True, on_delete=django.db.models.deletion.PROTECT, to='reporting.staffmember')),
                        ('region', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='reporting.region')),
                    ],
                    options={
                        'db_table': 'ops_regional_issues',
                        'db_table_comment': '현재 리전별 운영 이슈·조치',
                        'ordering': ['-updated_at', '-id'],
                    },
                ),
                migrations.CreateModel(
                    name='IssueComment',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('author_name', models.CharField(max_length=150)),
                        ('author_username', models.CharField(blank=True, db_default='', default='', max_length=150)),
                        ('content', models.TextField()),
                        ('created_at', models.DateTimeField(auto_now_add=True, db_default=django.db.models.functions.datetime.Now())),
                        ('issue', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='comments', to='issues.regionalissue')),
                    ],
                    options={
                        'db_table': 'ops_issue_comments',
                        'db_table_comment': '운영 이슈 댓글',
                        'ordering': ['created_at', 'id'],
                    },
                ),
                migrations.AddConstraint(
                    model_name='regionalissue',
                    constraint=models.CheckConstraint(condition=models.Q(('progress_percent__lte', 100)), name='issue_progress_max_100'),
                ),
                migrations.AddConstraint(
                    model_name='regionalissue',
                    constraint=models.CheckConstraint(condition=models.Q(('status__in', ['open', 'blocked', 'resolved'])), name='current_issue_valid_status'),
                ),
                migrations.AddConstraint(
                    model_name='regionalissue',
                    constraint=models.CheckConstraint(condition=models.Q(('severity__in', ['critical', 'major', 'minor', 'info'])), name='current_issue_valid_severity'),
                ),
                migrations.AddConstraint(
                    model_name='regionalissue',
                    constraint=models.CheckConstraint(condition=models.Q(models.Q(('status', 'resolved'), _negated=True), ('progress_percent', 100), _connector='OR'), name='resolved_issue_progress_100'),
                ),
    
            ],
            database_operations=[],
        ),
    ]
