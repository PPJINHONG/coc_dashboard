from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('staff', '0003_profile_calendar_responsibilities')]
    operations = [migrations.CreateModel(
        name='StaffChoice',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('kind', models.CharField(choices=[('company_name', '소속사'), ('work_location', '근무지')], max_length=20)),
            ('country_code', models.CharField(blank=True, db_default='', default='', max_length=2)),
            ('value', models.CharField(max_length=150)),
        ],
        options={'db_table': 'ops_staff_choices', 'ordering': ['kind', 'country_code', 'value', 'id'], 'constraints': [
            models.UniqueConstraint(fields=('kind', 'country_code', 'value'), name='unique_staff_choice'),
            models.CheckConstraint(condition=models.Q(kind__in=['company_name', 'work_location']), name='staff_choice_valid_kind'),
            models.CheckConstraint(condition=models.Q(country_code__in=['', 'KR', 'EU', 'NA']), name='staff_choice_valid_country'),
            models.CheckConstraint(condition=models.Q(kind='company_name', country_code='') | models.Q(kind='work_location', country_code__in=['KR', 'EU', 'NA']), name='staff_choice_country_scope'),
        ]},
    )]
