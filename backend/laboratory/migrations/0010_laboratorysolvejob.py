import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("laboratory", "0009_savedlaboratoryresult"),
    ]

    operations = [
        migrations.CreateModel(
            name="LaboratorySolveJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("module", models.CharField(db_index=True, max_length=64)),
                ("operation", models.CharField(default="solve", max_length=64)),
                ("payload", models.JSONField(default=dict)),
                ("payload_hash", models.CharField(db_index=True, max_length=64)),
                ("status", models.CharField(choices=[("queued", "Queued"), ("running", "Running"), ("completed", "Completed"), ("failed", "Failed"), ("cancel_requested", "Cancel requested"), ("cancelled", "Cancelled")], db_index=True, default="queued", max_length=24)),
                ("progress", models.PositiveSmallIntegerField(default=0)),
                ("estimated_runtime_ms", models.PositiveIntegerField(default=0)),
                ("timeout_ms", models.PositiveIntegerField(default=30000)),
                ("result", models.JSONField(blank=True, default=dict)),
                ("error", models.TextField(blank=True, default="")),
                ("cache_hit", models.BooleanField(default=False)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("cancel_requested", models.BooleanField(default=False)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="laboratorysolvejob",
            index=models.Index(fields=["module", "payload_hash", "status"], name="laboratory__module_a5ba06_idx"),
        ),
    ]
