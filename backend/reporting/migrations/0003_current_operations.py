from django.db import migrations, models


def retain_latest(apps, schema_editor):
    Week = apps.get_model('reporting', 'ReportWeek')
    latest = Week.objects.order_by('-week_start').values_list('week_start', flat=True).first()
    Issue = apps.get_model('reporting', 'WeeklyIssue')
    keep_issues = Issue.objects.filter(week_id=latest, is_included=True).values_list('id', flat=True) if latest else []
    apps.get_model('reporting', 'IssueComment').objects.exclude(weekly_issue_id__in=keep_issues).delete()
    for name in ('WeeklyIssue', 'WeeklyResource', 'WeeklyStaff', 'WeeklyWork'):
        model = apps.get_model('reporting', name)
        if latest:
            model.objects.exclude(week_id=latest, is_included=True).delete()
        else:
            model.objects.all().delete()
    apps.get_model('reporting', 'ChangeLog').objects.filter(section__in=['weeks', 'kubernetes']).delete()


class Migration(migrations.Migration):
    dependencies = [('reporting', '0002_readable_views')]
    operations = [
        migrations.RunSQL('DROP VIEW IF EXISTS report_infrastructure_by_week; DROP VIEW IF EXISTS report_staff_by_week; DROP VIEW IF EXISTS report_work_by_week;', reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL('DROP TABLE IF EXISTS public.test;', reverse_sql=migrations.RunSQL.noop),
        migrations.RunPython(retain_latest, reverse_code=None),
        migrations.RunSQL('SET CONSTRAINTS ALL IMMEDIATE;', reverse_sql=migrations.RunSQL.noop),
        migrations.RenameModel('WeeklyResource', 'InfrastructureResource'),
        migrations.RenameModel('WeeklyStaff', 'StaffAssignment'),
        migrations.RenameModel('WeeklyWork', 'WorkSummary'),
        migrations.RenameModel('WeeklyIssue', 'RegionalIssue'),
        migrations.RenameField('issuecomment', 'weekly_issue', 'issue'),
        migrations.RemoveConstraint('infrastructureresource', 'unique_weekly_resource_zone'),
        migrations.RemoveConstraint('staffassignment', 'unique_weekly_staff_assignment'),
        migrations.RemoveConstraint('worksummary', 'unique_weekly_work_scope'),
        migrations.RemoveConstraint('regionalissue', 'unique_weekly_issue_update'),
        migrations.RemoveField('infrastructureresource', 'week'),
        migrations.RemoveField('staffassignment', 'week'),
        migrations.RemoveField('worksummary', 'week'),
        migrations.RemoveField('regionalissue', 'week'),
        migrations.RemoveField('regionalissue', 'issue'),
        migrations.RemoveField('changelog', 'week'),
        migrations.DeleteModel('WeeklyKubernetes'),
        migrations.DeleteModel('ReportWeek'),
        migrations.DeleteModel('Issue'),
        migrations.CreateModel(name='DataState', fields=[
            ('id', models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False, serialize=False)),
            ('revision', models.PositiveIntegerField(default=0, db_default=0)),
            ('updated_at', models.DateTimeField(auto_now=True, db_default=models.functions.Now())),
        ], options={'db_table': 'ops_data_state', 'constraints': [models.CheckConstraint(condition=models.Q(id=1), name='single_operations_state')]}),
    ]
