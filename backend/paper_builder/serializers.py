from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from .models import ScientificPaper, ScientificPaperSection
from .live_bridge import extract_lab_result_targets


class ScientificPaperSectionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ScientificPaperSection
        fields = (
            "id",
            "title",
            "slug",
            "kind",
            "progress_state",
            "order",
            "content",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class ScientificPaperSerializer(serializers.ModelSerializer):
    sections = ScientificPaperSectionSerializer(many=True, required=False)
    section_count = serializers.IntegerField(read_only=True)
    laboratory_usage_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ScientificPaper
        fields = (
            "id",
            "title",
            "slug",
            "abstract",
            "content",
            "authors",
            "keywords",
            "document_kind",
            "branding_enabled",
            "branding_label",
            "article",
            "created_at",
            "updated_at",
            "published_at",
            "status",
            "sections",
            "section_count",
            "laboratory_usage_count",
        )
        read_only_fields = ("slug", "article", "published_at", "created_at", "updated_at", "section_count", "laboratory_usage_count")

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        status_value = attrs.get("status", getattr(instance, "status", "draft"))
        title = attrs.get("title", getattr(instance, "title", ""))
        content = attrs.get("content", getattr(instance, "content", ""))
        sections = attrs.get("sections")

        if sections is not None:
            compiled = self._compile_sections(sections)
            if compiled:
                content = compiled

        if status_value == "published":
            if not (title or "").strip():
                raise serializers.ValidationError({"title": "Published paper uchun sarlavha majburiy."})
            if not (content or "").strip():
                raise serializers.ValidationError({"content": "Published paper uchun matn majburiy."})
        if len((title or "").strip()) > 500:
            raise serializers.ValidationError({"title": "Title is too long."})
        if len((content or "").strip()) > 400000:
            raise serializers.ValidationError({"content": "Paper content is too large."})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        sections_data = validated_data.pop("sections", None)
        paper = ScientificPaper.objects.create(**validated_data)
        self._upsert_sections(paper, sections_data)
        self._sync_laboratory_usages(paper)
        return paper

    @transaction.atomic
    def update(self, instance, validated_data):
        sections_data = validated_data.pop("sections", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()
        self._upsert_sections(instance, sections_data)
        self._sync_laboratory_usages(instance)
        return instance

    def _compile_sections(self, sections_data: list[dict]) -> str:
        chunks: list[str] = []
        for item in sorted(sections_data, key=lambda section: section.get("order", 0)):
            content = (item.get("content") or "").strip()
            if not content:
                continue

            title = (item.get("title") or "").strip()
            if title and not content.lstrip().startswith("#"):
                chunks.append(f"## {title}\n\n{content}")
            else:
                chunks.append(content)

        return "\n\n---\n\n".join(chunks).strip()

    def _normalize_section_payload(self, paper: ScientificPaper, section_data: dict, order: int) -> dict:
        title = (section_data.get("title") or "").strip() or f"Section {order}"
        slug = (section_data.get("slug") or "").strip()

        if not slug:
            base = slugify(title) or "section"
            slug = f"{base}-{paper.pk}-{order}"[:255]

        return {
            "title": title,
            "slug": slug,
            "kind": section_data.get("kind") or "section",
            "progress_state": section_data.get("progress_state") or "todo",
            "order": section_data.get("order") or order,
            "content": section_data.get("content") or "",
        }

    def _sync_legacy_single_section(self, paper: ScientificPaper):
        compiled_content = (paper.content or "").strip()
        default_title = (paper.title or "").strip() or "Main Draft"
        first_section = paper.sections.order_by("order", "id").first()

        if first_section is None:
            ScientificPaperSection.objects.create(
                paper=paper,
                title=default_title,
                kind="section",
                progress_state="drafting" if compiled_content else "todo",
                order=1,
                content=compiled_content,
            )
            return

        first_section.title = default_title
        first_section.kind = first_section.kind or "section"
        first_section.progress_state = first_section.progress_state or ("drafting" if compiled_content else "todo")
        first_section.order = 1
        first_section.content = compiled_content
        first_section.slug = first_section.slug or f"{slugify(default_title) or 'section'}-{paper.pk}-1"
        first_section.save()
        paper.sections.exclude(pk=first_section.pk).delete()

    def _upsert_sections(self, paper: ScientificPaper, sections_data: list[dict] | None):
        if sections_data is None:
            self._sync_legacy_single_section(paper)
            paper.content = paper.build_compiled_content()
            paper.save(update_fields=["content", "updated_at"])
            return

        existing_by_id = {section.id: section for section in paper.sections.all()}
        seen_ids: set[int] = set()

        for default_order, section_data in enumerate(sections_data, start=1):
            section_id = section_data.get("id")
            normalized = self._normalize_section_payload(paper, section_data, default_order)

            if section_id and section_id in existing_by_id:
                section = existing_by_id[section_id]
                seen_ids.add(section_id)
                for field, value in normalized.items():
                    setattr(section, field, value)
                section.save()
                continue

            created = ScientificPaperSection.objects.create(paper=paper, **normalized)
            seen_ids.add(created.id)

        paper.sections.exclude(id__in=seen_ids).delete()
        paper.content = paper.build_compiled_content()
        paper.save(update_fields=["content", "updated_at"])

    def _sync_laboratory_usages(self, paper: ScientificPaper):
        from laboratory.models import SavedLaboratoryResult
        from .models import PaperLaboratoryUsage

        seen_block_ids: set[str] = set()
        for target in extract_lab_result_targets(paper.content or ""):
            saved_result_id = target.get("savedResultId")
            block_id = target.get("id")
            if not saved_result_id or not block_id:
                continue

            try:
                saved_result = SavedLaboratoryResult.objects.get(public_id=saved_result_id)
            except SavedLaboratoryResult.DoesNotExist:
                continue

            seen_block_ids.add(block_id)
            imported_revision = target.get("savedResultRevision") or saved_result.revision or 1
            synced_revision = ((target.get("revision") or imported_revision) if isinstance(target.get("revision"), int) else imported_revision)
            PaperLaboratoryUsage.objects.update_or_create(
                paper=paper,
                block_id=block_id,
                defaults={
                    "saved_result": saved_result,
                    "module_slug": target.get("moduleSlug") or saved_result.module_slug,
                    "section_path": target.get("sectionPath") or "",
                    "imported_revision": imported_revision,
                    "synced_revision": synced_revision,
                },
            )

        paper.laboratory_usages.exclude(block_id__in=seen_block_ids).delete()
