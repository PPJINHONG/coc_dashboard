import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_dashboardpanel'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=150)),
                ('action', models.CharField(max_length=30)),
                ('target_type', models.CharField(blank=True, default='', max_length=40)),
                ('target_id', models.CharField(blank=True, default='', max_length=40)),
                ('summary', models.CharField(max_length=300)),
                ('before_data', models.JSONField(blank=True, default=dict)),
                ('after_data', models.JSONField(blank=True, default=dict)),
                ('changes', models.JSONField(blank=True, default=dict)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_activity_logs',
                'db_table_comment': '사용자 행동 이력: 로그인·등록·수정(이전값/새값)·삭제(원본)',
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['user', '-created_at'], name='user_activity_user_time')],
            },
        ),
    ]
