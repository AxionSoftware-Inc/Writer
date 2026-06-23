from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0009_savedlaboratoryresult"),
        ("paper_builder", "0004_scientificpapersection_progress_state"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaperLaboratoryUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("block_id", models.CharField(max_length=120)),
                ("module_slug", models.SlugField(max_length=64)),
                ("section_path", models.CharField(blank=True, default="", max_length=500)),
                ("imported_revision", models.PositiveIntegerField(default=1)),
                ("synced_revision", models.PositiveIntegerField(default=1)),
                ("linked_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("paper", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="laboratory_usages", to="paper_builder.scientificpaper")),
                ("saved_result", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="paper_usages", to="laboratory.savedlaboratoryresult")),
            ],
            options={
                "ordering": ["-updated_at", "-linked_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="paperlaboratoryusage",
            constraint=models.UniqueConstraint(fields=("paper", "block_id"), name="unique_paper_lab_block_usage"),
        ),
    ]
