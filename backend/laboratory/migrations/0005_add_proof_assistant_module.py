from django.db import migrations


def add_proof_assistant_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")

    LaboratoryModule.objects.update_or_create(
        slug="proof-assistant",
        defaults={
            "title": "Proof Assistant",
            "summary": "Structured theorem, lemma and proof planning workspace for mathematical writing.",
            "description": "Design proof skeletons, choose a strategy and turn mathematical ideas into clean writer-ready argument maps.",
            "category": "custom",
            "icon_name": "BookText",
            "accent_color": "rose",
            "computation_mode": "client",
            "estimated_minutes": 15,
            "sort_order": 6,
            "is_enabled": True,
            "config": {
                "defaultTitle": "Teorema sarlavhasi",
                "defaultStatement": "Agar shartlar bajarilsa, natija kelib chiqadi.",
                "defaultAssumptions": "1. Berilgan shart\n2. Yordamchi faraz",
                "defaultGoal": "Natijani isbotlash",
                "defaultStrategy": "direct",
            },
        },
    )


def remove_proof_assistant_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.filter(slug="proof-assistant").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0004_add_geometry_module"),
    ]

    operations = [
        migrations.RunPython(add_proof_assistant_module, remove_proof_assistant_module),
    ]
