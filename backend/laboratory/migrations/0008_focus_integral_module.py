from django.db import migrations


def focus_integral_module(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.exclude(slug="integral-studio").update(is_enabled=False)
    LaboratoryModule.objects.filter(slug="integral-studio").update(is_enabled=True, sort_order=1)


def restore_modules(apps, schema_editor):
    LaboratoryModule = apps.get_model("laboratory", "LaboratoryModule")
    LaboratoryModule.objects.update(is_enabled=True)


class Migration(migrations.Migration):
    dependencies = [
        ("laboratory", "0007_remove_laboratorymodule_project"),
    ]

    operations = [
        migrations.RunPython(focus_integral_module, restore_modules),
    ]
