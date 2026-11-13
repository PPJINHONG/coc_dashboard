import django.db.models.deletion
import django.db.models.functions.datetime
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("reporting", "0019_change_log_period_month"),
    ]

    operations = [
        migrations.CreateModel(
            name="RegionalRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("period_month", models.DateField(db_comment="요청일 기준 월(그 달 1일)", db_index=True)),
                ("title", models.CharField(max_length=200)),
                ("content_html", models.TextField()),
                ("requester", models.CharField(max_length=200)),
                ("requested_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("schedule_timezone", models.CharField(choices=[("UTC", "미국 (UTC)"), ("KST", "한국 (KST)"), ("CET", "유럽 (CET)")], max_length=3)),
                ("schedule_start", models.DateTimeField(db_index=True)),
                ("schedule_end", models.DateTimeField()),
                ("status", models.CharField(choices=[("open", "Open"), ("in_progress", "In Progress"), ("completed", "Completed")], db_default="open", default="open", max_length=15)),
                ("assignee_regions", models.JSONField(db_default=[], default=list)),
                ("author_name", models.CharField(max_length=150)),
                ("author_username", models.CharField(blank=True, db_default="", default="", max_length=150)),
                ("updated_at", models.DateTimeField(auto_now=True, db_default=django.db.models.functions.datetime.Now())),
                ("author", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_regional_requests", to=settings.AUTH_USER_MODEL)),
                ("region", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="regional_requests", to="reporting.region")),
            ],
            options={
                "db_table": "ops_regional_requests",
                "db_table_comment": "요청일 기준 월별 권역 요청작업 티켓",
                "ordering": ["-period_month", "schedule_start", "id"],
                "constraints": [
                    models.CheckConstraint(condition=Q(("period_month__day", 1)), name="regional_request_month_first_day"),
                    models.CheckConstraint(condition=Q(("schedule_end__gt", F("schedule_start"))), name="regional_request_schedule_order"),
                    models.CheckConstraint(condition=Q(("status__in", ["open", "in_progress", "completed"])), name="regional_request_valid_status"),
                    models.CheckConstraint(condition=Q(("schedule_timezone__in", ["UTC", "KST", "CET"])), name="regional_request_valid_timezone"),
                ],
            },
        ),
        migrations.CreateModel(
            name="RegionalRequestImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.ImageField(upload_to="regional_requests/%Y/%m/")),
                ("original_name", models.CharField(blank=True, db_default="", default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_default=django.db.models.functions.datetime.Now())),
                ("request", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="images", to="regional_requests.regionalrequest")),
                ("uploader", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="regional_request_images", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "ops_regional_request_images",
                "db_table_comment": "권역 요청작업 본문 이미지",
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="RegionalRequestAssignee",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="regional_requests.regionalrequest")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="regional_request_assignments", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "ops_regional_request_assignees",
                "db_table_comment": "권역 요청작업 담당 계정",
                "ordering": ["request_id", "user_id"],
                "constraints": [models.UniqueConstraint(fields=("request", "user"), name="unique_regional_request_assignee")],
            },
        ),
        migrations.AddField(
            model_name="regionalrequest",
            name="assignees",
            field=models.ManyToManyField(related_name="assigned_regional_requests", through="regional_requests.RegionalRequestAssignee", to=settings.AUTH_USER_MODEL),
        ),
    ]
