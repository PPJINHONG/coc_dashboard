from django.db import migrations, models
from django.db.models import Q


def map_region_groups(apps, schema_editor):
    RegionalRequest = apps.get_model("regional_requests", "RegionalRequest")
    for ticket in RegionalRequest.objects.select_related("region"):
        country = ticket.region.country_code
        ticket.region_group = country if country in ("NA", "EU") else "KR"
        ticket.save(update_fields=["region_group"])


class Migration(migrations.Migration):
    dependencies = [
        ("regional_requests", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="regionalrequest",
            name="region_group",
            field=models.CharField(blank=True, choices=[("KR", "KR"), ("NA", "NA"), ("EU", "EU")], max_length=2, null=True),
        ),
        migrations.AddField(
            model_name="regionalrequest",
            name="assignee_name",
            field=models.CharField(blank=True, db_default="", default="", max_length=200),
        ),
        migrations.RunPython(map_region_groups, migrations.RunPython.noop),
        migrations.RemoveField(model_name="regionalrequest", name="assignees"),
        migrations.DeleteModel(name="RegionalRequestAssignee"),
        migrations.RemoveField(model_name="regionalrequest", name="region"),
        migrations.RenameField(model_name="regionalrequest", old_name="region_group", new_name="region"),
        migrations.AlterField(
            model_name="regionalrequest",
            name="region",
            field=models.CharField(choices=[("KR", "KR"), ("NA", "NA"), ("EU", "EU")], max_length=2),
        ),
        migrations.AddConstraint(
            model_name="regionalrequest",
            constraint=models.CheckConstraint(condition=Q(region__in=["KR", "NA", "EU"]), name="regional_request_valid_region"),
        ),
    ]
