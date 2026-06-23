from django.db import migrations


def add_notebook_studio_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")

    LaboratoryModule.objects.update_or_create(
        slug="notebook-studio",
        defaults={
            "title": "Notebook Studio",
            "summary": "Jupyter-like mathematical notebook with modular cells, rich outputs and writer export flow.",
            "description": "Compose markdown, series, limit and Taylor cells inside a reusable notebook workspace designed for mathematical research and drafting.",
            "category": "custom",
            "icon_name": "BookOpenText",
            "accent_color": "cyan",
            "computation_mode": "client",
            "estimated_minutes": 18,
            "sort_order": 7,
            "is_enabled": True,
            "config": {
                "defaultTitle": "Untitled Math Notebook",
                "defaultCells": ["markdown", "series"],
            },
        },
    )


def remove_notebook_studio_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.filter(slug="notebook-studio").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0005_add_proof_assistant_module"),
    ]

    operations = [
        migrations.RunPython(add_notebook_studio_module, remove_notebook_studio_module),
    ]
