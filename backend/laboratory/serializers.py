from django.utils import timezone
from rest_framework import serializers

from .method_registry import INTEGRAL_METHOD_CHOICES
from .models import LaboratoryModule, LaboratorySolveJob, SavedLaboratoryResult


class LaboratoryModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LaboratoryModule
        fields = [
            "id",
            "title",
            "slug",
            "summary",
            "description",
            "category",
            "icon_name",
            "accent_color",
            "computation_mode",
            "estimated_minutes",
            "sort_order",
            "is_enabled",
            "config",
            "created_at",
            "updated_at",
        ]


class SavedLaboratoryResultSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)

    class Meta:
        model = SavedLaboratoryResult
        fields = [
            "id",
            "module_slug",
            "module_title",
            "mode",
            "title",
            "summary",
            "report_markdown",
            "input_snapshot",
            "structured_payload",
            "metadata",
            "revision",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "revision", "created_at", "updated_at"]

    def _normalize_metadata_standard(self, metadata, attrs):
        if not isinstance(metadata, dict):
            metadata = {}
        if metadata.get("schema_version") == 1 and metadata.get("result_standard") == "mathsphere.saved_lab_result":
            return metadata

        structured_payload = attrs.get("structured_payload") or {}
        now = timezone.now().isoformat()
        return {
            **metadata,
            "schema_version": 1,
            "result_standard": "mathsphere.saved_lab_result",
            "original_input": attrs.get("input_snapshot") or {},
            "provenance": {
                "app": "MathSphere Laboratory",
                "source_label": metadata.get("sourceLabel") or attrs.get("module_title") or "Laboratory",
                "module_slug": attrs.get("module_slug") or "",
                "module_title": attrs.get("module_title") or "",
                "mode": attrs.get("mode") or "",
                "generated_at": structured_payload.get("generatedAt") or now,
                "saved_at": now,
            },
            "computation": {
                "status": metadata.get("status") or metadata.get("computation_status") or "unknown",
                "method": metadata.get("method") or structured_payload.get("kind") or attrs.get("mode") or "unknown",
                "tolerance": metadata.get("tolerance"),
                "runtime_ms": metadata.get("runtime_ms"),
                "engine": metadata.get("engine") or "sympy/manual-js-hybrid",
                "warnings": metadata.get("warnings") if isinstance(metadata.get("warnings"), list) else [],
                "errors": metadata.get("errors") if isinstance(metadata.get("errors"), list) else [],
            },
            "verification_certificate": metadata.get("verification_certificate") or {
                "status": "not_requested",
                "trust_score": None,
                "checks": [],
                "warnings": [],
                "recommendations": [],
            },
        }

    def _validate_metadata_standard(self, metadata):
        if not isinstance(metadata, dict):
            raise serializers.ValidationError({"metadata": "Metadata must be an object."})

        schema_version = metadata.get("schema_version")
        if schema_version != 1:
            raise serializers.ValidationError({"metadata": "schema_version=1 is required."})

        if metadata.get("result_standard") != "mathsphere.saved_lab_result":
            raise serializers.ValidationError({"metadata": "result_standard must be mathsphere.saved_lab_result."})

        computation = metadata.get("computation")
        if not isinstance(computation, dict):
            raise serializers.ValidationError({"metadata": "computation object is required."})

        status = computation.get("status")
        allowed_statuses = {"exact", "numeric", "hybrid", "approximate", "failed", "unknown"}
        if status not in allowed_statuses:
            raise serializers.ValidationError({"metadata": "computation.status is invalid."})

        method = computation.get("method")
        if not isinstance(method, str) or not method.strip():
            raise serializers.ValidationError({"metadata": "computation.method is required."})

        runtime_ms = computation.get("runtime_ms")
        if runtime_ms is not None and (not isinstance(runtime_ms, (int, float)) or runtime_ms < 0):
            raise serializers.ValidationError({"metadata": "computation.runtime_ms must be a non-negative number."})

        tolerance = computation.get("tolerance")
        if tolerance is not None and not isinstance(tolerance, (int, float, str)):
            raise serializers.ValidationError({"metadata": "computation.tolerance must be a number, string, or null."})

        for key in ("warnings", "errors"):
            value = computation.get(key, [])
            if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                raise serializers.ValidationError({"metadata": f"computation.{key} must be a list of strings."})

        provenance = metadata.get("provenance")
        if not isinstance(provenance, dict):
            raise serializers.ValidationError({"metadata": "provenance object is required."})

        for key in ("module_slug", "module_title", "mode", "generated_at", "saved_at"):
            if not isinstance(provenance.get(key), str) or not provenance[key].strip():
                raise serializers.ValidationError({"metadata": f"provenance.{key} is required."})

    def validate(self, attrs):
        structured_payload = attrs.get("structured_payload")
        metadata = self._normalize_metadata_standard(attrs.get("metadata") or {}, attrs)
        attrs["metadata"] = metadata
        input_snapshot = attrs.get("input_snapshot") or {}
        report_markdown = attrs.get("report_markdown", "")

        if not structured_payload:
            raise serializers.ValidationError({"structured_payload": "Structured payload is required."})
        if not report_markdown.strip():
            raise serializers.ValidationError({"report_markdown": "Report markdown is required."})
        if len(report_markdown) > 120000:
            raise serializers.ValidationError({"report_markdown": "Report markdown is too large."})
        if len(str(input_snapshot)) > 50000:
            raise serializers.ValidationError({"input_snapshot": "Input snapshot is too large."})
        if len(str(structured_payload)) > 180000:
            raise serializers.ValidationError({"structured_payload": "Structured payload is too large."})
        if len(str(metadata)) > 30000:
            raise serializers.ValidationError({"metadata": "Metadata is too large."})
        self._validate_metadata_standard(metadata)
        return attrs


class LaboratorySolveJobSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)

    class Meta:
        model = LaboratorySolveJob
        fields = [
            "id",
            "module",
            "operation",
            "payload",
            "payload_hash",
            "status",
            "progress",
            "estimated_runtime_ms",
            "timeout_ms",
            "result",
            "error",
            "cache_hit",
            "attempts",
            "cancel_requested",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "payload_hash",
            "status",
            "progress",
            "result",
            "error",
            "cache_hit",
            "attempts",
            "cancel_requested",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]

    def validate_payload(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("payload must be an object.")
        if len(str(value)) > 50000:
            raise serializers.ValidationError("payload is too large.")
        return value


class LaboratorySolveJobCreateSerializer(serializers.Serializer):
    module = serializers.ChoiceField(choices=("integral", "differential", "matrix", "probability", "series-limit"))
    operation = serializers.CharField(max_length=64, required=False, default="solve")
    payload = serializers.JSONField()
    timeout_ms = serializers.IntegerField(required=False, default=30000, min_value=1000, max_value=300000)

    def validate_payload(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("payload must be an object.")
        return value


class IntegralSolveRequestSerializer(serializers.Serializer):
    expression = serializers.CharField(max_length=400)
    lower = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    upper = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    method = serializers.ChoiceField(
        choices=INTEGRAL_METHOD_CHOICES,
        required=False,
        default="auto",
    )


class IntegralVerificationRequestSerializer(serializers.Serializer):
    expression = serializers.CharField(max_length=400)
    lower = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    upper = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    antiderivative_latex = serializers.CharField(max_length=2400, allow_blank=True, required=False, default="")
    result_latex = serializers.CharField(max_length=2400, allow_blank=True, required=False, default="")
    method = serializers.CharField(max_length=80, allow_blank=True, required=False, default="auto")


class DifferentialVerificationRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40, required=False, default="derivative")
    expression = serializers.CharField(max_length=400)
    variable = serializers.CharField(max_length=80, required=False, default="x")
    result_latex = serializers.CharField(max_length=2400, allow_blank=True, required=False, default="")


class MatrixVerificationRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40, required=False, default="algebra")
    expression = serializers.CharField(max_length=800)
    rhs = serializers.CharField(max_length=400, allow_blank=True, required=False, default="")


class ProbabilityVerificationRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40, required=False, default="descriptive")
    dataset = serializers.CharField(max_length=1200)
    parameters = serializers.CharField(max_length=400, allow_blank=True, required=False, default="")


class SeriesLimitVerificationRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40, required=False, default="limits")
    expression = serializers.CharField(max_length=800)
    auxiliary = serializers.CharField(max_length=400, allow_blank=True, required=False, default="")


class LaboratoryAIExplainRequestSerializer(serializers.Serializer):
    module = serializers.CharField(max_length=64, required=False, default="integral")
    expression = serializers.CharField(max_length=800, allow_blank=True, required=False, default="")
    expression_latex = serializers.CharField(max_length=1600, allow_blank=True, required=False, default="")
    lower = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    upper = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    result_latex = serializers.CharField(max_length=2400, allow_blank=True, required=False, default="")
    numeric_approximation = serializers.CharField(max_length=160, allow_blank=True, required=False, default="")
    method = serializers.JSONField(required=False, default=dict)
    steps = serializers.JSONField(required=False, default=list)
    reproducibility = serializers.JSONField(required=False, default=dict)
    model = serializers.CharField(max_length=180, allow_blank=True, required=False, default="")
    temperature = serializers.FloatField(required=False, default=0.2, min_value=0.0, max_value=1.0)
    max_tokens = serializers.IntegerField(required=False, default=520, min_value=120, max_value=900)

    def validate_steps(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("steps must be a list.")
        return value[:12]

    def validate_method(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("method must be an object.")
        return value

    def validate_reproducibility(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("reproducibility must be an object.")
        return value


class DifferentialSolveRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40)
    expression = serializers.CharField(max_length=400)
    variable = serializers.CharField(max_length=80)
    point = serializers.CharField(max_length=80, allow_blank=True, required=False, default="1")
    order = serializers.CharField(max_length=10, allow_blank=True, required=False, default="1")
    direction = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    coordinates = serializers.CharField(max_length=24, allow_blank=True, required=False, default="cartesian")


class MatrixSolveRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40)
    expression = serializers.CharField(max_length=800)
    rhs = serializers.CharField(max_length=400, allow_blank=True, required=False, default="")
    dimension = serializers.CharField(max_length=20, allow_blank=True, required=False, default="")


class ProbabilitySolveRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40)
    dataset = serializers.CharField(max_length=1200)
    parameters = serializers.CharField(max_length=400, allow_blank=True, required=False, default="")
    dimension = serializers.CharField(max_length=40, allow_blank=True, required=False, default="")


class SeriesLimitSolveRequestSerializer(serializers.Serializer):
    mode = serializers.CharField(max_length=40)
    expression = serializers.CharField(max_length=1200)
    auxiliary = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")
    dimension = serializers.CharField(max_length=40, allow_blank=True, required=False, default="")
