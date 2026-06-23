from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("application", "0003_visitorlog"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="visitorlog",
            index=models.Index(fields=["timestamp"], name="app_visitor_timesta_5de647_idx"),
        ),
        migrations.AddIndex(
            model_name="visitorlog",
            index=models.Index(fields=["path"], name="app_visitor_path_03b970_idx"),
        ),
        migrations.AddIndex(
            model_name="visitorlog",
            index=models.Index(fields=["timestamp", "path"], name="app_visitor_timesta_f57e42_idx"),
        ),
    ]
