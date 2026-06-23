from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DifferentialSolveAPIView,
    DifferentialVerificationAPIView,
    IntegralSolveAPIView,
    IntegralVerificationAPIView,
    LaboratoryAIExplainAPIView,
    LaboratoryAIExplainStreamAPIView,
    LaboratoryAIStatusAPIView,
    LaboratoryMethodRegistryAPIView,
    LaboratoryModuleViewSet,
    LaboratoryObservabilityAPIView,
    LaboratorySolveJobViewSet,
    MatrixSolveAPIView,
    MatrixVerificationAPIView,
    ProbabilitySolveAPIView,
    ProbabilityVerificationAPIView,
    SavedLaboratoryResultViewSet,
    SeriesLimitSolveAPIView,
    SeriesLimitVerificationAPIView,
)

router = DefaultRouter()
router.register(r"modules", LaboratoryModuleViewSet, basename="laboratory-module")
router.register(r"results", SavedLaboratoryResultViewSet, basename="laboratory-result")
router.register(r"jobs", LaboratorySolveJobViewSet, basename="laboratory-solve-job")

urlpatterns = [
    path("solve/integral/", IntegralSolveAPIView.as_view(), name="laboratory-integral-solve"),
    path("verify/integral/", IntegralVerificationAPIView.as_view(), name="laboratory-integral-verify"),
    path("verify/differential/", DifferentialVerificationAPIView.as_view(), name="laboratory-differential-verify"),
    path("verify/matrix/", MatrixVerificationAPIView.as_view(), name="laboratory-matrix-verify"),
    path("verify/probability/", ProbabilityVerificationAPIView.as_view(), name="laboratory-probability-verify"),
    path("verify/series-limit/", SeriesLimitVerificationAPIView.as_view(), name="laboratory-series-limit-verify"),
    path("ai/explain/", LaboratoryAIExplainAPIView.as_view(), name="laboratory-ai-explain"),
    path("ai/explain/stream/", LaboratoryAIExplainStreamAPIView.as_view(), name="laboratory-ai-explain-stream"),
    path("ai/status/", LaboratoryAIStatusAPIView.as_view(), name="laboratory-ai-status"),
    path("methods/", LaboratoryMethodRegistryAPIView.as_view(), name="laboratory-method-registry"),
    path("observability/", LaboratoryObservabilityAPIView.as_view(), name="laboratory-observability"),
    path("solve/differential/", DifferentialSolveAPIView.as_view(), name="laboratory-differential-solve"),
    path("solve/matrix/", MatrixSolveAPIView.as_view(), name="laboratory-matrix-solve"),
    path("solve/probability/", ProbabilitySolveAPIView.as_view(), name="laboratory-probability-solve"),
    path("solve/series-limit/", SeriesLimitSolveAPIView.as_view(), name="laboratory-series-limit-solve"),
    path("", include(router.urls)),
]
