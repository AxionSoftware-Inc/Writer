from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0008_focus_integral_module"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedLaboratoryResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("module_slug", models.SlugField(db_index=True, max_length=64)),
                ("module_title", models.CharField(max_length=120)),
                ("mode", models.CharField(blank=True, default="", max_length=64)),
                ("title", models.CharField(max_length=180)),
                ("summary", models.CharField(blank=True, default="", max_length=255)),
                ("report_markdown", models.TextField()),
                ("input_snapshot", models.JSONField(blank=True, default=dict)),
                ("structured_payload", models.JSONField(blank=True, default=dict)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
    ]
