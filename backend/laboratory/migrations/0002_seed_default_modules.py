from django.db import migrations


def seed_default_modules(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")

    modules = [
        {
            "title": "Matrix Workbench",
            "slug": "matrix-workbench",
            "summary": "Matrix algebra, determinant, inverse and multiplication workspace.",
            "description": "Interactively experiment with matrix operations and compare linear algebra results.",
            "category": "matrix",
            "icon_name": "Grid3X3",
            "accent_color": "blue",
            "computation_mode": "client",
            "estimated_minutes": 12,
            "sort_order": 1,
            "config": {
                "defaultA": "2 1\n1 3",
                "defaultB": "1 0\n4 2",
                "operations": ["add", "multiply", "determinant", "inverse"],
            },
        },
        {
            "title": "Integral Studio",
            "slug": "integral-studio",
            "summary": "Numerical integration with midpoint, trapezoid and Simpson methods.",
            "description": "Approximate definite integrals and inspect sampled curves without stressing the server.",
            "category": "integral",
            "icon_name": "AreaChart",
            "accent_color": "emerald",
            "computation_mode": "client",
            "estimated_minutes": 10,
            "sort_order": 2,
            "config": {
                "defaultExpression": "sin(x) + x^2 / 5",
                "defaultLower": 0,
                "defaultUpper": 3.14,
                "defaultSegments": 24,
            },
        },
        {
            "title": "Differential Lab",
            "slug": "differential-lab",
            "summary": "Initial value problem sandbox with Euler and Heun trajectories.",
            "description": "Study first-order differential equations with adjustable steps and side-by-side approximations.",
            "category": "differential",
            "icon_name": "ChartLine",
            "accent_color": "amber",
            "computation_mode": "client",
            "estimated_minutes": 14,
            "sort_order": 3,
            "config": {
                "defaultDerivative": "x - y",
                "defaultX0": 0,
                "defaultY0": 1,
                "defaultStep": 0.2,
                "defaultSteps": 20,
            },
        },
    ]

    for payload in modules:
        LaboratoryModule.objects.update_or_create(slug=payload["slug"], defaults=payload)


def unseed_default_modules(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.filter(
        slug__in=["matrix-workbench", "integral-studio", "differential-lab"]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_default_modules, unseed_default_modules),
    ]
