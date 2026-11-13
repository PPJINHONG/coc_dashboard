from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('reporting', '0019_change_log_period_month')]

    operations = [
        migrations.AddField(model_name='changelog', name='restore_data',
                            field=models.JSONField(blank=True, db_default={}, default=dict)),
        migrations.AddField(model_name='changelog', name='restored_from',
                            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                                                       related_name='restoration', to='reporting.changelog',
                                                       db_comment='복구한 원본 변경 이력')),
    ]
