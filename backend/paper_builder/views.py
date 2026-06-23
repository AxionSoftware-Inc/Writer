import json
import logging

from django.db.models import Count, Q
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from .models import PaperLaboratoryUsage, ScientificPaper
from .serializers import ScientificPaperSerializer
from .live_bridge import extract_lab_result_targets, parse_lab_result_block, replace_lab_result_block


logger = logging.getLogger(__name__)


class PaperLiveSyncRequestSerializer(serializers.Serializer):
    block_id = serializers.CharField(max_length=120)
    block = serializers.JSONField()
    saved_result_id = serializers.UUIDField(required=False)

    def validate_block(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Block payload must be an object.")
        if value.get("id") != self.initial_data.get("block_id"):
            raise serializers.ValidationError("Block id mismatch.")
        return value

class ScientificPaperViewSet(viewsets.ModelViewSet):
    queryset = ScientificPaper.objects.all()
    serializer_class = ScientificPaperSerializer
    permission_classes = [AllowAny] # Allow any since this is a global writing tool for now
    throttle_classes = [ScopedRateThrottle]

    def get_throttles(self):
        if getattr(self, "action", None) == "live_targets":
            self.throttle_scope = "paper_live_targets"
        elif getattr(self, "action", None) == "live_sync":
            self.throttle_scope = "paper_live_sync"
        return super().get_throttles()

    def get_queryset(self):
        queryset = ScientificPaper.objects.select_related("article").prefetch_related("sections", "laboratory_usages").annotate(
            section_count=Count("sections"),
            laboratory_usage_count=Count("laboratory_usages", distinct=True),
        )
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("q")

        if status_value in {"draft", "published"}:
            queryset = queryset.filter(status=status_value)

        if search:
            query = search.strip()
            queryset = queryset.filter(Q(title__icontains=query) | Q(abstract__icontains=query))

        return queryset

    @action(detail=False, methods=["get"], url_path="live-targets")
    def live_targets(self, request):
        query = (request.query_params.get("q") or "").strip().lower()
        module_slug = (request.query_params.get("module_slug") or "").strip()
        targets: list[dict] = []

        papers = (
            ScientificPaper.objects.prefetch_related("sections")
            .annotate(section_count=Count("sections"), laboratory_usage_count=Count("laboratory_usages", distinct=True))
            .order_by("-updated_at")[:80]
        )
        for paper in papers:
            for target in extract_lab_result_targets(paper.content or ""):
                haystack = " ".join(
                    [
                        str(paper.title or ""),
                        str(target.get("title") or ""),
                        str(target.get("sectionPath") or ""),
                        str(target.get("moduleSlug") or ""),
                    ]
                ).lower()
                if query and query not in haystack:
                    continue
                if module_slug and target.get("moduleSlug") != module_slug:
                    continue
                targets.append(
                    {
                        "paperId": paper.id,
                        "paperTitle": paper.title or "Untitled Paper",
                        "paperStatus": paper.status,
                        "paperUpdatedAt": paper.updated_at,
                        **target,
                    }
                )

        return Response(targets)

    @action(detail=True, methods=["post"], url_path="live-sync")
    def live_sync(self, request, pk=None):
        paper = self.get_object()
        serializer = PaperLiveSyncRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        block_id = serializer.validated_data["block_id"]
        block = serializer.validated_data["block"]

        if not parse_lab_result_block(json.dumps(block)):
            return Response({"detail": "Invalid block payload."}, status=status.HTTP_400_BAD_REQUEST)

        paper.content = replace_lab_result_block(paper.content or "", block)
        paper.save(update_fields=["content", "updated_at"])
        self._sync_laboratory_usages(paper)
        logger.info(
            "paper_live_sync_ok",
            extra={
                "paper_id": paper.id,
                "block_id": block_id,
                "saved_result_id": str(serializer.validated_data.get("saved_result_id") or ""),
            },
        )
        return Response({"status": "ok", "paper_id": paper.id, "block_id": block_id})

    def _sync_laboratory_usages(self, paper: ScientificPaper):
        from laboratory.models import SavedLaboratoryResult

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
            synced_revision = target.get("revision") if isinstance(target.get("revision"), int) else imported_revision
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
