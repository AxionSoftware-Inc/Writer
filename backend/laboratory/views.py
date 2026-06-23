import logging

from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .integral_solver import IntegralSolverError, solve_single_integral
from .event_log import log_laboratory_event
from .job_runner import estimate_runtime_ms, submit_job
from .method_registry import INTEGRAL_METHODS
from .differential_solver import DifferentialSolverError, solve_differential
from .matrix_solver import MatrixSolverError, solve_matrix
from .probability_solver import ProbabilitySolverError, solve_probability
from .series_limit_solver import SeriesLimitSolverError, solve_series_limit
from .models import LaboratoryEventLog, LaboratoryModule, LaboratorySolveJob, SavedLaboratoryResult
from .ai_explainer import (
    LaboratoryAIExplainerError,
    get_lm_studio_status,
    request_lm_studio_explanation,
    stream_lm_studio_explanation,
)
from .verification import (
    VerificationError,
    verify_differential_certificate,
    verify_integral_certificate,
    verify_matrix_certificate,
    verify_probability_certificate,
    verify_series_limit_certificate,
)
from .serializers import (
    DifferentialSolveRequestSerializer,
    DifferentialVerificationRequestSerializer,
    IntegralSolveRequestSerializer,
    IntegralVerificationRequestSerializer,
    LaboratoryAIExplainRequestSerializer,
    LaboratoryModuleSerializer,
    LaboratorySolveJobCreateSerializer,
    LaboratorySolveJobSerializer,
    MatrixSolveRequestSerializer,
    MatrixVerificationRequestSerializer,
    ProbabilitySolveRequestSerializer,
    ProbabilityVerificationRequestSerializer,
    SavedLaboratoryResultSerializer,
    SeriesLimitSolveRequestSerializer,
    SeriesLimitVerificationRequestSerializer,
)


logger = logging.getLogger(__name__)

class LaboratoryModuleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LaboratoryModule.objects.all()
    serializer_class = LaboratoryModuleSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method == "GET":
            queryset = queryset.filter(is_enabled=True, slug="integral-studio")
        return queryset

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        value = self.kwargs[lookup_url_kwarg]

        if value.isdigit():
            obj = queryset.filter(pk=value).first()
            if obj:
                return obj

        return get_object_or_404(queryset, slug=value)


class SavedLaboratoryResultViewSet(viewsets.ModelViewSet):
    queryset = SavedLaboratoryResult.objects.all()
    serializer_class = SavedLaboratoryResultSerializer
    permission_classes = [AllowAny]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    lookup_field = "public_id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "summary", "module_slug", "module_title", "mode"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-updated_at"]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "laboratory_results"

    def get_queryset(self):
        queryset = super().get_queryset()
        module_slug = self.request.query_params.get("module_slug")
        if module_slug:
            queryset = queryset.filter(module_slug=module_slug)
        mode = self.request.query_params.get("mode")
        if mode:
            queryset = queryset.filter(mode=mode)
        query = (self.request.query_params.get("q") or "").strip()
        if query:
            queryset = queryset.filter(title__icontains=query)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_laboratory_event(
            "saved_result_created",
            module=instance.module_slug,
            object_public_id=instance.public_id,
            payload={"mode": instance.mode, "title": instance.title},
        )
        logger.info(
            "laboratory_result_created",
            extra={
                "result_id": str(instance.public_id),
                "module_slug": instance.module_slug,
                "mode": instance.mode,
                "revision": instance.revision,
            },
        )

    def perform_update(self, serializer):
        instance = serializer.save(revision=serializer.instance.revision + 1)
        log_laboratory_event(
            "saved_result_updated",
            module=instance.module_slug,
            object_public_id=instance.public_id,
            payload={"mode": instance.mode, "title": instance.title, "revision": instance.revision},
        )
        logger.info(
            "laboratory_result_updated",
            extra={
                "result_id": str(instance.public_id),
                "module_slug": instance.module_slug,
                "mode": instance.mode,
                "revision": instance.revision,
            },
        )


class LaboratorySolveJobViewSet(viewsets.ModelViewSet):
    queryset = LaboratorySolveJob.objects.all()
    serializer_class = LaboratorySolveJobSerializer
    permission_classes = [AllowAny]
    http_method_names = ["get", "post", "head", "options"]
    lookup_field = "public_id"
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "laboratory_results"

    def create(self, request, *args, **kwargs):
        serializer = LaboratorySolveJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        module = serializer.validated_data["module"]
        payload = serializer.validated_data["payload"]
        payload_hash = LaboratorySolveJob.hash_payload({"module": module, "payload": payload})
        cached = (
            LaboratorySolveJob.objects.filter(module=module, payload_hash=payload_hash, status="completed")
            .order_by("-updated_at")
            .first()
        )
        if cached:
            cached.cache_hit = True
            cached.save(update_fields=["cache_hit", "updated_at"])
            return Response(self.get_serializer(cached).data, status=status.HTTP_200_OK)

        job = LaboratorySolveJob.objects.create(
            module=module,
            operation=serializer.validated_data.get("operation", "solve"),
            payload=payload,
            payload_hash=payload_hash,
            timeout_ms=serializer.validated_data.get("timeout_ms", 30000),
            estimated_runtime_ms=estimate_runtime_ms(module, payload),
        )
        log_laboratory_event(
            "solve_job_created",
            module=module,
            object_public_id=job.public_id,
            payload={"operation": job.operation, "estimated_runtime_ms": job.estimated_runtime_ms},
        )
        submit_job(job)
        return Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, public_id=None):
        job = self.get_object()
        if job.status in {"completed", "failed", "cancelled"}:
            return Response(self.get_serializer(job).data)
        job.cancel_requested = True
        job.status = "cancel_requested"
        job.save(update_fields=["cancel_requested", "status", "updated_at"])
        return Response(self.get_serializer(job).data)

    @action(detail=True, methods=["post"])
    def retry(self, request, public_id=None):
        previous = self.get_object()
        job = LaboratorySolveJob.objects.create(
            module=previous.module,
            operation=previous.operation,
            payload=previous.payload,
            payload_hash=previous.payload_hash,
            timeout_ms=previous.timeout_ms,
            estimated_runtime_ms=previous.estimated_runtime_ms,
        )
        submit_job(job)
        return Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)


class IntegralSolveAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = IntegralSolveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = solve_single_integral(
                expression=serializer.validated_data["expression"],
                lower=serializer.validated_data["lower"],
                upper=serializer.validated_data["upper"],
                method=serializer.validated_data.get("method", "auto"),
            )
        except IntegralSolverError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": result.status,
                "message": result.message,
                **result.payload,
            }
        )


class IntegralVerificationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = IntegralVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            certificate = verify_integral_certificate(**serializer.validated_data)
        except VerificationError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"status": "ok", "certificate": certificate.as_dict()})


class DifferentialVerificationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = DifferentialVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"status": "ok", "certificate": verify_differential_certificate(**serializer.validated_data).as_dict()})


class MatrixVerificationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = MatrixVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"status": "ok", "certificate": verify_matrix_certificate(**serializer.validated_data).as_dict()})


class ProbabilityVerificationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = ProbabilityVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"status": "ok", "certificate": verify_probability_certificate(**serializer.validated_data).as_dict()})


class SeriesLimitVerificationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = SeriesLimitVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"status": "ok", "certificate": verify_series_limit_certificate(**serializer.validated_data).as_dict()})


class LaboratoryMethodRegistryAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        def normalize_contract(contract):
            status_map = {
                "active": "implemented",
                "code-ready": "code-ready",
                "planned": "locked",
            }
            adapter_status = contract.get("adapter_status", "code-ready")
            return {
                **contract,
                "execution_status": status_map.get(adapter_status, "experimental"),
                "locked": adapter_status == "planned",
                "experimental": adapter_status not in {"active", "code-ready", "planned"},
            }

        shared_contracts = {
            "differential": [
                {"id": "separable", "label": "Separable ODE", "family": "analytic", "adapter_status": "code-ready", "backend_adapter": "differential.ode.fallback", "fallback_reason": "Falls back to symbolic dsolve when pattern-specific adapter cannot certify separation.", "benchmark_test": "ode_separable_basic"},
                {"id": "laplace", "label": "Laplace transform", "family": "analytic", "adapter_status": "planned", "backend_adapter": None, "fallback_reason": "Visible as pro method until transform adapter lands.", "benchmark_test": "ode_laplace_step"},
                {"id": "solve-ivp", "label": "solve_ivp / RK", "family": "numeric", "adapter_status": "code-ready", "backend_adapter": "differential.numeric.solve_ivp", "fallback_reason": "Frontend/code route available; backend symbolic lane remains primary.", "benchmark_test": "ode_numeric_decay"},
            ],
            "matrix": [
                {"id": "exact-linear-algebra", "label": "Exact matrix algebra", "family": "analytic", "adapter_status": "active", "backend_adapter": "matrix_solver.solve_matrix", "fallback_reason": "", "benchmark_test": "matrix_rank_det"},
                {"id": "condition-number", "label": "Condition number audit", "family": "numeric", "adapter_status": "code-ready", "backend_adapter": "verification.matrix", "fallback_reason": "Verification certificate computes risk even when solve lane is symbolic.", "benchmark_test": "matrix_nearly_singular"},
            ],
            "probability": [
                {"id": "descriptive-confidence", "label": "Descriptive confidence", "family": "hybrid", "adapter_status": "active", "backend_adapter": "probability_solver.solve_probability", "fallback_reason": "", "benchmark_test": "probability_descriptive"},
                {"id": "monte-carlo-ci", "label": "Monte Carlo confidence interval", "family": "numeric", "adapter_status": "code-ready", "backend_adapter": "probability.monte_carlo", "fallback_reason": "Confidence certificate flags small samples.", "benchmark_test": "probability_pi_sampler"},
            ],
            "series-limit": [
                {"id": "limit-existence", "label": "Limit existence", "family": "analytic", "adapter_status": "active", "backend_adapter": "series_limit_solver.solve_series_limit", "fallback_reason": "", "benchmark_test": "limit_basic"},
                {"id": "convergence-proof", "label": "Convergence proof", "family": "analytic", "adapter_status": "code-ready", "backend_adapter": "verification.series_limit", "fallback_reason": "Certificate provides symbolic attempt; formal proof adapter remains gated.", "benchmark_test": "series_geometric"},
            ],
        }
        return Response(
            {
                "version": 1,
                "contracts": {
                    "integral": [
                        normalize_contract({"id": method_id, **metadata})
                        for method_id, metadata in INTEGRAL_METHODS.items()
                    ],
                    **{
                        module: [normalize_contract(contract) for contract in contracts]
                        for module, contracts in shared_contracts.items()
                    },
                },
                "status_meaning": {
                    "implemented": "Backend adapter is implemented and used directly.",
                    "code-ready": "UI/code/report contract is ready; backend uses symbolic/numeric fallback while exposing method intent.",
                    "experimental": "Available for research preview, not final report source of truth.",
                    "locked": "Visible as roadmap or premium-gated method until adapter lands.",
                },
            }
        )


class LaboratoryAIExplainAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "laboratory_ai"

    def post(self, request, *args, **kwargs):
        serializer = LaboratoryAIExplainRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log_laboratory_event(
            "ai_explain_requested",
            module=serializer.validated_data.get("module", ""),
            payload={"stream": False, "expression_length": len(serializer.validated_data.get("expression", ""))},
        )

        try:
            explanation = request_lm_studio_explanation(serializer.validated_data)
        except LaboratoryAIExplainerError as exc:
            log_laboratory_event(
                "ai_explain_failed",
                module=serializer.validated_data.get("module", ""),
                payload={"error": str(exc)[:500], "stream": False},
            )
            return Response(
                {
                    "status": "unavailable",
                    "message": str(exc),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "status": "ok",
                **explanation,
            }
        )


class LaboratoryAIExplainStreamAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "laboratory_ai"

    def post(self, request, *args, **kwargs):
        serializer = LaboratoryAIExplainRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log_laboratory_event(
            "ai_explain_requested",
            module=serializer.validated_data.get("module", ""),
            payload={"stream": True, "expression_length": len(serializer.validated_data.get("expression", ""))},
        )

        def stream():
            try:
                for chunk in stream_lm_studio_explanation(serializer.validated_data):
                    yield chunk
            except LaboratoryAIExplainerError as exc:
                log_laboratory_event(
                    "ai_explain_failed",
                    module=serializer.validated_data.get("module", ""),
                    payload={"error": str(exc)[:500], "stream": True},
                )
                yield f"\n\nAI server ulanmagan: {exc}"

        return StreamingHttpResponse(stream(), content_type="text/plain; charset=utf-8")


class LaboratoryAIStatusAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        return Response({"status": "ok", **get_lm_studio_status()})


class LaboratoryObservabilityAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        job_counts = {
            item["status"]: item["count"]
            for item in LaboratorySolveJob.objects.values("status").annotate(count=Count("id"))
        }
        event_counts = {
            item["event_type"]: item["count"]
            for item in LaboratoryEventLog.objects.values("event_type").annotate(count=Count("id"))
        }
        module_counts = {
            item["module"]: item["count"]
            for item in LaboratorySolveJob.objects.values("module").annotate(count=Count("id"))
        }
        recent_failures = list(
            LaboratoryEventLog.objects.filter(event_type__in=["solve_job_failed", "ai_explain_failed"])
            .values("event_type", "module", "object_public_id", "payload", "created_at")[:10]
        )
        averages = LaboratorySolveJob.objects.aggregate(
            average_estimated_runtime_ms=Avg("estimated_runtime_ms"),
            average_timeout_ms=Avg("timeout_ms"),
        )
        return Response(
            {
                "status": "ok",
                "saved_result_count": SavedLaboratoryResult.objects.count(),
                "solve_job_count": LaboratorySolveJob.objects.count(),
                "failed_solve_count": job_counts.get("failed", 0),
                "report_snapshot_count": SavedLaboratoryResult.objects.filter(metadata__reportFormat__isnull=False).count(),
                "ai_failure_count": event_counts.get("ai_explain_failed", 0),
                "job_counts": job_counts,
                "event_counts": event_counts,
                "module_job_counts": module_counts,
                "runtime": averages,
                "recent_failures": recent_failures,
            }
        )


class DifferentialSolveAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = DifferentialSolveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = solve_differential(
                mode=serializer.validated_data["mode"],
                expression=serializer.validated_data["expression"],
                variable=serializer.validated_data["variable"],
                point=serializer.validated_data.get("point", "1"),
                order=serializer.validated_data.get("order", "1"),
                direction=serializer.validated_data.get("direction", ""),
                coordinates=serializer.validated_data.get("coordinates", "cartesian"),
            )
        except DifferentialSolverError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": result.status,
                "message": result.message,
                **result.payload,
            }
        )


class MatrixSolveAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = MatrixSolveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = solve_matrix(
                mode=serializer.validated_data["mode"],
                expression=serializer.validated_data["expression"],
                rhs_expression=serializer.validated_data.get("rhs", ""),
                dimension=serializer.validated_data.get("dimension", ""),
            )
        except MatrixSolverError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": result.status,
                "message": result.message,
                **result.payload,
            }
        )


class ProbabilitySolveAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = ProbabilitySolveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = solve_probability(
                mode=serializer.validated_data["mode"],
                dataset=serializer.validated_data["dataset"],
                parameters=serializer.validated_data.get("parameters", ""),
                dimension=serializer.validated_data.get("dimension", ""),
            )
        except ProbabilitySolverError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": result.status,
                "message": result.message,
                **result.payload,
            }
        )


class SeriesLimitSolveAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = SeriesLimitSolveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = solve_series_limit(
                mode=serializer.validated_data["mode"],
                expression=serializer.validated_data["expression"],
                auxiliary=serializer.validated_data.get("auxiliary", ""),
                dimension=serializer.validated_data.get("dimension", ""),
            )
        except SeriesLimitSolverError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": result.status,
                "message": result.message,
                **result.payload,
            }
        )
