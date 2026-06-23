from django.db import migrations


def add_geometry_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")

    LaboratoryModule.objects.update_or_create(
        slug="geometry-studio",
        defaults={
            "title": "Geometry Studio",
            "summary": "Analytic geometry workspace with lines, distances, midpoints and intersections.",
            "description": "Model points and lines on a shared plane, inspect equations and prepare for deeper geometry modules.",
            "category": "geometry",
            "icon_name": "Rotate3D",
            "accent_color": "teal",
            "computation_mode": "client",
            "estimated_minutes": 13,
            "sort_order": 5,
            "is_enabled": True,
            "config": {
                "defaultAx": 0,
                "defaultAy": 0,
                "defaultBx": 4,
                "defaultBy": 3,
                "defaultCx": 0,
                "defaultCy": 4,
                "defaultDx": 5,
                "defaultDy": 0,
            },
        },
    )


def remove_geometry_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.filter(slug="geometry-studio").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0003_add_series_limits_module"),
    ]

    operations = [
        migrations.RunPython(add_geometry_module, remove_geometry_module),
    ]
