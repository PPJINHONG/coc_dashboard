from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('staff', '0011_alter_staffcolumn_options_and_more')]
    operations = [
        migrations.CreateModel(
            name='StaffTableLayout',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name_position', models.PositiveIntegerField(default=0)),
                ('region_position', models.PositiveIntegerField(default=1)),
            ],
        ),
    ]
