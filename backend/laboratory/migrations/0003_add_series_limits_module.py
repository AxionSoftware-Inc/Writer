from django.db import migrations


def add_series_limits_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")

    LaboratoryModule.objects.update_or_create(
        slug="series-limits-studio",
        defaults={
            "title": "Series & Limits Studio",
            "summary": "Series convergence, partial sums and limit probing in one analysis module.",
            "description": "Explore sequences, partial sums and one-point limit behavior inside a single modular analysis workspace.",
            "category": "analysis",
            "icon_name": "Sigma",
            "accent_color": "violet",
            "computation_mode": "client",
            "estimated_minutes": 11,
            "sort_order": 4,
            "is_enabled": True,
            "config": {
                "defaultSeriesExpression": "1 / n^2",
                "defaultSeriesStart": 1,
                "defaultSeriesCount": 12,
                "defaultLimitExpression": "sin(x) / x",
                "defaultLimitPoint": 0,
                "defaultLimitRadius": 1,
            },
        },
    )


def remove_series_limits_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.filter(slug="series-limits-studio").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0002_seed_default_modules"),
    ]

    operations = [
        migrations.RunPython(add_series_limits_module, remove_series_limits_module),
    ]
