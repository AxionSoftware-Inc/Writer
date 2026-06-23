from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("laboratory", "0010_laboratorysolvejob"),
    ]

    operations = [
        migrations.CreateModel(
            name="LaboratoryEventLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[("saved_result_created", "Saved result created"), ("saved_result_updated", "Saved result updated"), ("solve_job_created", "Solve job created"), ("solve_job_completed", "Solve job completed"), ("solve_job_failed", "Solve job failed"), ("solve_job_cancelled", "Solve job cancelled"), ("ai_explain_requested", "AI explain requested"), ("ai_explain_failed", "AI explain failed")], db_index=True, max_length=64)),
                ("module", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("object_public_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["event_type", "created_at"], name="laboratory__event_t_4d5fe6_idx"),
                    models.Index(fields=["module", "created_at"], name="laboratory__module_3dcd48_idx"),
                ],
            },
        ),
    ]
