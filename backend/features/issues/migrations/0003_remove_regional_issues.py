from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("issues", "0002_monthly_period"),
    ]

    operations = [
        migrations.DeleteModel(name="IssueComment"),
        migrations.DeleteModel(name="RegionalIssue"),
    ]
