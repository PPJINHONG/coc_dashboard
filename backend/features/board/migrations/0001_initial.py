"""core 앱에 있던 게시판 모델을 이 앱으로 옮깁니다.

테이블과 데이터는 그대로 두고 Django가 기억하는 모델 위치(상태)만 바꿉니다. DB는 변경하지 않습니다.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0004_move_board_dashboard_models'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Post',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('title', models.CharField(max_length=200)),
                        ('content', models.TextField()),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='posts', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'core_post',
                        'ordering': ['-created_at'],
                    },
                ),
                migrations.CreateModel(
                    name='Comment',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('content', models.TextField()),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to=settings.AUTH_USER_MODEL)),
                        ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='board.post')),
                    ],
                    options={
                        'db_table': 'core_comment',
                        'ordering': ['created_at'],
                    },
                ),
                migrations.CreateModel(
                    name='PostImage',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('file', models.ImageField(upload_to='board/%Y/%m/')),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('post', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='images', to='board.post')),
                        ('uploader', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='uploaded_images', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'core_postimage',
                    },
                ),
    
            ],
            database_operations=[],
        ),
    ]
