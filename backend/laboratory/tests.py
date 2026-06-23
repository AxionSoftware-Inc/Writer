from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .job_runner import run_job
from .models import LaboratoryEventLog, LaboratoryModule, LaboratorySolveJob, SavedLaboratoryResult


class LaboratoryModuleApiTests(APITestCase):
    def setUp(self):
        self.integral_module = LaboratoryModule.objects.get(slug="integral-studio")
        LaboratoryModule.objects.create(
            title="Disabled Module",
            slug="disabled-module",
            summary="Disabled module.",
            description="This one should stay hidden.",
            category="custom",
            computation_mode="client",
            is_enabled=False,
            sort_order=99,
        )

    def test_list_modules_returns_only_enabled_integral_module(self):
        url = reverse("laboratory-module-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_slugs = [item["slug"] for item in response.data]

        self.assertIn("integral-studio", returned_slugs)
        self.assertNotIn("matrix-workbench", returned_slugs)
        self.assertNotIn("differential-lab", returned_slugs)
        self.assertNotIn("disabled-module", returned_slugs)
        self.assertEqual(len(returned_slugs), 1)

    def test_retrieve_module_supports_slug_lookup(self):
        url = reverse("laboratory-module-detail", args=[self.integral_module.slug])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.integral_module.title)
        self.assertEqual(response.data["category"], "integral")


class IntegralSolveApiTests(APITestCase):
    def test_exact_single_integral_solution(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "x^2", "lower": "0", "upper": "1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "\\frac{1}{3}")
        self.assertEqual(response.data["exact"]["numeric_approximation"], "0.333333333333333")

    def test_parser_translates_keyboard_style_expression(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "2x^2 + ln(x)", "lower": "1", "upper": "e"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["parser"]["expression_normalized"], "2x^2 + log(x)")
        self.assertEqual(response.data["exact"]["method_label"], "Logarithmic Structure")
        self.assertTrue(len(response.data["exact"]["steps"]) >= 4)
        self.assertEqual(response.data["diagnostics"]["research"]["exactness_tier"], "symbolic_closed_form")
        self.assertEqual(response.data["diagnostics"]["research"]["readiness_label"], "research_review")

    def test_non_elementary_integral_requests_numerical_confirmation(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "exp(-x^2) / log(x)", "lower": "2", "upper": "3"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "needs_numerical")
        self.assertTrue(response.data["can_offer_numerical"])
        self.assertEqual(response.data["diagnostics"]["research"]["exactness_tier"], "requires_numerical_confirmation")
        self.assertEqual(response.data["diagnostics"]["research"]["readiness_label"], "numerical_confirmation")

    def test_indefinite_integral_lane_returns_antiderivative(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "x^2", "lower": "", "upper": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertFalse(response.data["can_offer_numerical"])
        self.assertEqual(response.data["input"]["lane"], "indefinite_single")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "\\frac{x^{3}}{3} + C")

    def test_improper_integral_lane_handles_infinite_bound(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "exp(-x)", "lower": "0", "upper": "inf"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertFalse(response.data["can_offer_numerical"])
        self.assertEqual(response.data["input"]["lane"], "improper_single")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "1")

    def test_endpoint_singularity_uses_improper_lane(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "1/sqrt(x)", "lower": "0", "upper": "1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "improper_single")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "2")

    def test_piecewise_branch_metadata_is_returned(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "abs(x)", "lower": "-1", "upper": "1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["diagnostics"]["piecewise"]["active"])
        self.assertEqual(len(response.data["diagnostics"]["piecewise"]["regions"]), 2)
        self.assertEqual(response.data["diagnostics"]["piecewise"]["source"], "abs")

    def test_structured_domain_diagnostics_are_returned(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "log(x)/(x-1)", "lower": "2", "upper": "3"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        constraints = response.data["diagnostics"]["domain_analysis"]["constraints"]
        hazards = response.data["diagnostics"]["hazard_details"]
        self.assertTrue(any(item["kind"] == "log_argument_positive" for item in constraints))
        self.assertTrue(any(item["kind"] == "denominator_nonzero" for item in constraints))
        self.assertTrue(any(item["kind"] == "pole" for item in hazards))
        self.assertEqual(response.data["diagnostics"]["research"]["domain_risk_level"], "high")

    def test_improper_diagnostics_include_convergence_reason(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "exp(-x)", "lower": "0", "upper": "inf"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["diagnostics"]["convergence"], "convergent")
        self.assertEqual(response.data["diagnostics"]["convergence_reason"], "finite_symbolic_limit")
        self.assertIn("review_notes", response.data["diagnostics"]["research"])

    def test_line_integral_lane_solves_parametric_circulation(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "line(P=-y, Q=x, path=(cos(t), sin(t)), t:[0, 2*pi])", "lower": "", "upper": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "line_integral")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "2 \\pi")

    def test_surface_integral_lane_solves_parametric_flux(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "surface(f=(0, 0, 1), patch=(u, v, u + v), u:[0,1], v:[0,1])", "lower": "", "upper": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "surface_integral")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "1")

    def test_contour_integral_lane_solves_parametric_path(self):
        url = reverse("laboratory-integral-solve")
        response = self.client.post(
            url,
            {"expression": "contour(f=1/z, path=exp(I*t), t:[0, 2*pi])", "lower": "", "upper": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "contour_integral")
        self.assertEqual(response.data["exact"]["evaluated_latex"], "2 i \\pi")
        self.assertEqual(response.data["exact"]["residue_analysis"]["orientation"], "counterclockwise")
        self.assertTrue(response.data["exact"]["residue_analysis"]["direct_value_match"])
        self.assertEqual(len(response.data["exact"]["residue_analysis"]["enclosed_poles"]), 1)


class DifferentialSolveApiTests(APITestCase):
    def test_derivative_lane_returns_exact_result(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {"mode": "derivative", "expression": "x^3", "variable": "x", "point": "2", "order": "1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "derivative")
        self.assertTrue(response.data["exact"]["numeric_approximation"].startswith("12."))
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "publication_ready")
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")

    def test_directional_lane_uses_direction_vector(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "directional",
                "expression": "x^2 + y^2",
                "variable": "x, y",
                "point": "1, 0",
                "direction": "1, 1",
                "coordinates": "cartesian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "directional")
        self.assertTrue(response.data["diagnostics"]["directional"]["active"])
        self.assertEqual(response.data["exact"]["method_label"], "Symbolic Directional Derivative")
        self.assertIsNotNone(response.data["exact"]["evaluated_latex"])
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")

    def test_jacobian_lane_returns_matrix_diagnostics(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "jacobian",
                "expression": "[x + y, x - y]",
                "variable": "x, y",
                "point": "1, 2",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["diagnostics"]["matrix"]["lane"], "jacobian")
        self.assertEqual(response.data["diagnostics"]["matrix"]["shape"], "2x2")
        self.assertIn(response.data["diagnostics"]["matrix"]["determinant_status"], {"invertible", "near_singular"})
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "publication_ready")

    def test_hessian_lane_returns_curvature_diagnostics(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "hessian",
                "expression": "x^2 + y^2",
                "variable": "x, y",
                "point": "0, 0",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["diagnostics"]["matrix"]["lane"], "hessian")
        self.assertEqual(response.data["diagnostics"]["matrix"]["critical_point_type"], "Local minimum")
        self.assertEqual(response.data["exact"]["critical_point_type"], "Local minimum")
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")

    def test_ode_lane_solves_first_order_ivp(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "ode",
                "expression": "y' = y; y(0)=1",
                "variable": "x",
                "point": "y(0)=1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "ode")
        self.assertIn("y", response.data["exact"]["derivative_latex"])
        self.assertEqual(response.data["diagnostics"]["contract"]["completeness"], "complete")
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "publication_ready")
        self.assertEqual(response.data["diagnostics"]["contract"]["risk_level"], "low")
        self.assertTrue(response.data["diagnostics"]["contract"]["review_notes"])
        self.assertTrue(any(item["id"] == "initial_conditions" and item["status"] == "ok" for item in response.data["diagnostics"]["contract"]["checks"]))

    def test_pde_lane_solves_first_order_transport_family(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "pde",
                "expression": "u_t = u_x",
                "variable": "x, t",
                "point": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "pde")
        self.assertEqual(response.data["exact"]["method_label"], "SymPy pdsolve")
        self.assertEqual(response.data["diagnostics"]["contract"]["family_hint"], "transport_like")
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "working")
        self.assertEqual(response.data["diagnostics"]["contract"]["risk_level"], "medium")

    def test_pde_lane_reports_profile_contract_when_initial_data_is_present(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "pde",
                "expression": "u_t = u_x; u(x,0)=sin(x)",
                "variable": "x, t",
                "point": "u(x,0)=sin(x)",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["diagnostics"]["contract"]["family_hint"], "transport_like")
        self.assertEqual(response.data["diagnostics"]["contract"]["completeness"], "profiled")
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "publication_ready")
        self.assertTrue(any(item["id"] == "initial_profile" and item["status"] == "ok" for item in response.data["diagnostics"]["contract"]["checks"]))

    def test_sde_lane_runs_euler_maruyama(self):
        url = reverse("laboratory-differential-solve")
        response = self.client.post(
            url,
            {
                "mode": "sde",
                "expression": "dX = 0.4*X*dt + 0.2*X*dW; X(0)=1; t:[0,1]; n=64",
                "variable": "t",
                "point": "X(0)=1; t:[0,1]; n=64",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["input"]["lane"], "sde")
        self.assertEqual(response.data["exact"]["method_label"], "Euler-Maruyama")
        self.assertEqual(response.data["diagnostics"]["contract"]["completeness"], "complete")
        self.assertEqual(response.data["diagnostics"]["contract"]["discretization"], "coarse")
        self.assertEqual(response.data["diagnostics"]["contract"]["risk_level"], "high")
        self.assertTrue(any(item["id"] == "discretization" and item["status"] == "warn" for item in response.data["diagnostics"]["contract"]["checks"]))


class MatrixSolveApiTests(APITestCase):
    def test_algebra_lane_returns_determinant(self):
        url = reverse("laboratory-matrix-solve")
        response = self.client.post(
            url,
            {"mode": "algebra", "expression": "2 1; 1 3", "rhs": "", "dimension": "2x2"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["summary"]["determinant"], "5")
        self.assertTrue(response.data["summary"]["inverseAvailable"])
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "publication_ready")

    def test_systems_lane_solves_linear_system(self):
        url = reverse("laboratory-matrix-solve")
        response = self.client.post(
            url,
            {"mode": "systems", "expression": "2 1; 1 3", "rhs": "1; 0", "dimension": "2x2"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Linear System Solve")
        self.assertIn("x =", response.data["exact"]["result_latex"])
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")

    def test_systems_lane_reports_least_squares_audit_for_rectangular_matrix(self):
        url = reverse("laboratory-matrix-solve")
        response = self.client.post(
            url,
            {"mode": "systems", "expression": "1 0; 0 1; 1 1; 2 1; 1 2", "rhs": "1; 2; 2; 3; 3", "dimension": "5x2"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["solverKind"], "least_squares")
        self.assertIn("normal residual", response.data["summary"]["leastSquaresSummary"])
        self.assertIn("residual", response.data["summary"]["stabilitySummary"])
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "research_review")
        self.assertEqual(response.data["diagnostics"]["contract"]["risk_level"], "medium")

    def test_decomposition_lane_returns_spectrum(self):
        url = reverse("laboratory-matrix-solve")
        response = self.client.post(
            url,
            {"mode": "decomposition", "expression": "4 1; 1 3", "rhs": "", "dimension": "2x2"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Spectral Decomposition")
        self.assertEqual(response.data["summary"]["eigenSummary"], "Eigen spectrum extracted")
        self.assertIsNotNone(response.data["summary"]["factorAuditSummary"])

    def test_transform_lane_maps_probe_vector(self):
        url = reverse("laboratory-matrix-solve")
        response = self.client.post(
            url,
            {"mode": "transform", "expression": "1 2; 0 1", "rhs": "1; 1", "dimension": "2x2"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Linear Transform")
        self.assertIn("T(v)", response.data["exact"]["result_latex"])


class ProbabilitySolveApiTests(APITestCase):
    def test_descriptive_lane_returns_moments(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "descriptive", "dataset": "1,2,3,4,5", "parameters": "bins=4", "dimension": "1d"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["summary"]["sampleSize"], "5")
        self.assertEqual(response.data["exact"]["method_label"], "Descriptive Statistics")
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "publication_ready")

    def test_inference_lane_returns_p_value(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "inference", "dataset": "control: 42/210; variant: 57/205", "parameters": "alpha=0.05", "dimension": "2-group"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertIn("pValue", response.data["summary"])

    def test_regression_lane_returns_fit(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "regression", "dataset": "(1,2.1), (2,2.9), (3,4.2), (4,5.1), (5,6.2)", "parameters": "model=linear", "dimension": "2d"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertIn("regressionFit", response.data["summary"])
        self.assertIn("contract", response.data["diagnostics"])
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "research_review")

    def test_bayesian_lane_returns_posterior(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "bayesian", "dataset": "successes=58; trials=100", "parameters": "prior_alpha=2; prior_beta=3", "dimension": "posterior lane"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertIn("posteriorMean", response.data["summary"])
        self.assertEqual(response.data["exact"]["method_label"], "Beta-Binomial Posterior")
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")

    def test_multivariate_lane_returns_structure(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "multivariate", "dataset": "1,2,3; 2,3,4; 3,4,5; 4,5,6", "parameters": "labels=a,b,c", "dimension": "3-variable"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertIn("correlationSignal", response.data["summary"])
        self.assertEqual(response.data["diagnostics"]["contract"]["risk_level"], "medium")

    def test_time_series_lane_returns_forecast(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "time-series", "dataset": "112,118,121,126,133,129,138,144", "parameters": "window=3; horizon=2", "dimension": "1d temporal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertIn("forecast", response.data["summary"])
        self.assertIn("contract", response.data["diagnostics"])

    def test_distribution_lane_supports_exponential(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "distributions", "dataset": "x=1.5", "parameters": "family=exponential; lambda=1.2", "dimension": "1d"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["distributionFamily"], "exponential")
        self.assertEqual(response.data["diagnostics"]["contract"]["status"], "ok")

    def test_distribution_lane_supports_poisson(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "distributions", "dataset": "x=7", "parameters": "family=poisson; lambda=5.5", "dimension": "count process"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["distributionFamily"], "poisson")

    def test_distribution_lane_supports_beta(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "distributions", "dataset": "x=0.35", "parameters": "family=beta; alpha=2; beta=5", "dimension": "1d"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["distributionFamily"], "beta")

    def test_regression_lane_supports_quadratic(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "regression", "dataset": "(1,2.4), (2,3.1), (3,4.9), (4,7.8), (5,11.6), (6,16.1)", "parameters": "model=quadratic", "dimension": "2d"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["exact"]["method_label"], "Quadratic Least Squares")

    def test_inference_lane_supports_anova(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "inference", "dataset": "12, 13, 14, 15 | 10, 11, 12, 11 | 18, 19, 20, 17", "parameters": "test=anova", "dimension": "3-group"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "One-way ANOVA")

    def test_regression_lane_supports_multiple(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "regression", "dataset": "(1.0,0.5|3.2), (1.5,0.8|4.0), (2.0,1.2|5.1), (2.4,1.6|6.0)", "parameters": "model=multiple", "dimension": "2 predictors"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Multiple Least Squares")
        self.assertIn("rmse", response.data["summary"]["residualSignal"])
        self.assertIn("R^2", response.data["summary"]["intervalSignal"])

    def test_regression_lane_supports_logistic(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "regression", "dataset": "(-2,0), (-1,0), (0,0), (1,1), (2,1)", "parameters": "model=logistic", "dimension": "binary"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Logistic Regression")
        self.assertIn("accuracy", response.data["summary"]["outlierSignal"])
        self.assertIn("boundary", response.data["summary"]["leverageSignal"])

    def test_monte_carlo_lane_supports_bootstrap(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "monte-carlo", "dataset": "11,13,15,14,16,18,17,19", "parameters": "method=bootstrap; rounds=200; seed=21", "dimension": "resampling"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Bootstrap Mean Audit")
        self.assertIn("[", response.data["summary"]["confidenceInterval"])
        self.assertIn("stderr", response.data["summary"]["convergenceSignal"])
        self.assertEqual(response.data["diagnostics"]["contract"]["readiness_label"], "research_review")

    def test_multivariate_lane_reports_explained_variance_and_balance(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "multivariate", "dataset": "1,2,3; 2,3,4; 3,4,5; 6,7,8; 7,8,10", "parameters": "labels=a,b,c", "dimension": "correlation map"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("%", response.data["summary"]["explainedVariance"])
        self.assertIn("balance", response.data["summary"]["clusterBalance"])

    def test_time_series_lane_reports_forecast_interval(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "time-series", "dataset": "10,11,12,13,14,15,17,18", "parameters": "window=3; horizon=2; period=2", "dimension": "forecast interval"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("[", response.data["summary"]["forecastInterval"])
        self.assertIn("period-2", response.data["summary"]["seasonality"])

    def test_monte_carlo_sampler_compare_reports_interval_and_convergence(self):
        url = reverse("laboratory-probability-solve")
        response = self.client.post(
            url,
            {"mode": "monte-carlo", "dataset": "seed-lane", "parameters": "method=sampler_compare; samples=1500; seed=7", "dimension": "sampler compare"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("[", response.data["summary"]["confidenceInterval"])
        self.assertIn("error", response.data["summary"]["convergenceSignal"])


class SeriesLimitSolveApiTests(APITestCase):
    def test_limit_lane_returns_exact_limit(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "limits", "expression": "sin(x)/x", "auxiliary": "x -> 0", "dimension": "1 variable"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["exact"]["result_latex"], "1")
        self.assertEqual(response.data["summary"]["detectedFamily"], "removable singularity")
        self.assertEqual(response.data["exact"]["method_label"], "Removable singularity lane")
        self.assertIsNotNone(response.data["summary"]["errorBoundSignal"])
        self.assertTrue(response.data["preview"]["secondaryLineSeries"])
        self.assertTrue(response.data["preview"]["tertiaryLineSeries"])
        one_sided_step = next(step for step in response.data["exact"]["steps"] if step["title"] == "One-sided diagnostics")
        self.assertIn("left =", one_sided_step["summary"])

    def test_limit_lane_detects_infinite_point_branch(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "limits", "expression": "(3*x^2+1)/(x^2-4*x)", "auxiliary": "x -> inf", "dimension": "asymptotic"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["detectedFamily"], "infinite-point limit")
        self.assertEqual(response.data["exact"]["method_label"], "Asymptotic infinity lane")

    def test_sequence_lane_returns_tail_limit(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "sequences", "expression": "(1 + 1/n)^n", "auxiliary": "n -> inf", "dimension": "discrete"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["summary"]["detectedFamily"], "sequence")
        self.assertTrue(response.data["preview"]["lineSeries"])
        self.assertTrue(
            "forward difference" in response.data["summary"]["proofSignal"]
            or "tail ratio" in response.data["summary"]["proofSignal"]
        )

    def test_series_lane_solves_geometric_sum(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "series", "expression": "sum(1/2^n, n=1..inf)", "auxiliary": "", "dimension": "infinite series"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["exact"]["result_latex"], "1")
        self.assertEqual(response.data["summary"]["detectedFamily"], "geometric-like series")

    def test_series_lane_accepts_tuple_sum_syntax_and_singularity_scan(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "series", "expression": "sum(1/(n*log(n)^2), (n, 2, inf))", "auxiliary": "integral test", "dimension": "infinite series"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["detectedFamily"], "log-corrected series")
        self.assertIn("log", response.data["summary"]["endpointSignal"])
        family_step = next(step for step in response.data["exact"]["steps"] if step["title"] == "Family classification")
        self.assertEqual(family_step["latex"], "log-corrected series")

    def test_oscillatory_series_uses_dirichlet_screen(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "convergence", "expression": "sum(sin(n)/sqrt(n), n=1..inf)", "auxiliary": "Dirichlet test", "dimension": "oscillatory"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["detectedFamily"], "oscillatory trigonometric series")
        self.assertIn("Dirichlet", response.data["summary"]["proofSignal"])
        self.assertTrue(response.data["preview"]["tertiaryLineSeries"])
        self.assertEqual(response.data["summary"]["specialFamilySignal"], "Dirichlet/Abel candidate")
        self.assertIsNotNone(response.data["summary"]["errorBoundSignal"])
        self.assertEqual(response.data["exact"]["method_label"], "Dirichlet / Abel research lane")

    def test_power_series_lane_returns_radius_signal(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "power-series", "expression": "sum(x^n/n, n=1..inf)", "auxiliary": "center=0", "dimension": "power series"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "exact")
        self.assertEqual(response.data["summary"]["radiusSignal"], "1")
        self.assertEqual(len(response.data["summary"]["endpointDetails"]), 2)
        self.assertTrue(response.data["preview"]["tertiaryLineSeries"])

    def test_convergence_lane_reports_test_taxonomy(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "convergence", "expression": "sum(n!/n^n, n=1..inf)", "auxiliary": "ratio test", "dimension": "infinite series"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["testFamily"], "ratio test")
        self.assertEqual(response.data["summary"]["secondaryTestFamily"], "root/comparison cross-check")
        proof_step = next(step for step in response.data["exact"]["steps"] if step["title"] == "Proof helper")
        self.assertIsNotNone(proof_step["latex"])

    def test_cesaro_lane_uses_dedicated_method_label(self):
        url = reverse("laboratory-series-limit-solve")
        response = self.client.post(
            url,
            {"mode": "series", "expression": "sum((-1)^n, n=0..inf)", "auxiliary": "Cesaro", "dimension": "summability"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exact"]["method_label"], "Cesaro summability lane")
        self.assertEqual(response.data["summary"]["specialFamilySignal"], "Cesaro summability candidate")


class SavedLaboratoryResultApiTests(APITestCase):
    def setUp(self):
        self.result = SavedLaboratoryResult.objects.create(
            module_slug="integral-studio",
            module_title="Integral Studio",
            mode="single",
            title="Integral result packet",
            summary="Exact symbolic result ready",
            report_markdown="# Integral Report\n\n- Result: 1/3",
            input_snapshot={"expression": "x^2", "lower": "0", "upper": "1"},
            structured_payload={"moduleSlug": "integral-studio", "kind": "single", "title": "Integral block"},
            metadata={"sourceLabel": "Integral Studio"},
        )

    def test_can_create_saved_result(self):
        url = reverse("laboratory-result-list")
        response = self.client.post(
            url,
            {
                "module_slug": "matrix-studio",
                "module_title": "Matrix Studio",
                "mode": "algebra",
                "title": "Matrix audit",
                "summary": "Determinant and rank ready",
                "report_markdown": "# Matrix Report\n\n- determinant: 5",
                "input_snapshot": {"expression": "2 1; 1 3", "dimension": "2x2"},
                "structured_payload": {"moduleSlug": "matrix-studio", "kind": "algebra", "title": "Matrix block"},
                "metadata": {"sourceLabel": "Matrix Studio"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["module_slug"], "matrix-studio")
        self.assertTrue(response.data["id"])

    def test_list_saved_results_supports_module_filter(self):
        SavedLaboratoryResult.objects.create(
            module_slug="probability-studio",
            module_title="Probability Studio",
            mode="descriptive",
            title="Probability audit",
            summary="Sample moments ready",
            report_markdown="# Probability Report\n\n- mean: 3",
            input_snapshot={"dataset": "1,2,3,4,5"},
            structured_payload={"moduleSlug": "probability-studio", "kind": "descriptive", "title": "Probability block"},
            metadata={"sourceLabel": "Probability Studio"},
        )

        url = reverse("laboratory-result-list")
        response = self.client.get(url, {"module_slug": "integral-studio"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["module_slug"], "integral-studio")

    def test_retrieve_saved_result_by_public_id(self):
        url = reverse("laboratory-result-detail", args=[self.result.public_id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.result.title)
        self.assertEqual(response.data["structured_payload"]["moduleSlug"], "integral-studio")


class LaboratoryProductionContractTests(APITestCase):
    def test_solve_job_runs_with_cache_contract(self):
        url = reverse("laboratory-solve-job-list")
        payload = {"module": "integral", "payload": {"expression": "x^2", "lower": "0", "upper": "1"}}
        with patch("laboratory.views.submit_job", side_effect=lambda job: run_job(str(job.public_id))):
            first = self.client.post(url, payload, format="json")
            second = self.client.post(url, payload, format="json")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        detail = self.client.get(reverse("laboratory-solve-job-detail", args=[first.data["id"]]))
        self.assertEqual(detail.data["status"], "completed")
        self.assertEqual(detail.data["progress"], 100)
        self.assertEqual(detail.data["result"]["status"], "exact")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data["cache_hit"])
        self.assertEqual(LaboratorySolveJob.objects.count(), 1)
        self.assertTrue(LaboratoryEventLog.objects.filter(event_type="solve_job_completed").exists())

    def test_method_registry_exposes_backend_contracts(self):
        response = self.client.get(reverse("laboratory-method-registry"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("integral", response.data["contracts"])
        self.assertIn("differential", response.data["contracts"])
        differential = response.data["contracts"]["differential"][0]
        self.assertIn("adapter_status", differential)
        self.assertIn("backend_adapter", differential)
        self.assertIn("fallback_reason", differential)
        self.assertIn("benchmark_test", differential)

    def test_verification_contracts_cover_non_integral_modules(self):
        differential = self.client.post(
            reverse("laboratory-differential-verify"),
            {"mode": "derivative", "expression": "x^2", "variable": "x", "result_latex": "2 x"},
            format="json",
        )
        matrix = self.client.post(
            reverse("laboratory-matrix-verify"),
            {"mode": "algebra", "expression": "1 0; 0 1"},
            format="json",
        )
        probability = self.client.post(
            reverse("laboratory-probability-verify"),
            {"mode": "descriptive", "dataset": "1,2,3,4,5"},
            format="json",
        )
        series = self.client.post(
            reverse("laboratory-series-limit-verify"),
            {"mode": "limits", "expression": "1/x", "auxiliary": "x -> inf"},
            format="json",
        )

        self.assertEqual(differential.status_code, status.HTTP_200_OK)
        self.assertEqual(matrix.status_code, status.HTTP_200_OK)
        self.assertEqual(probability.status_code, status.HTTP_200_OK)
        self.assertEqual(series.status_code, status.HTTP_200_OK)
        self.assertIn("certificate", differential.data)
        self.assertIn("certificate", matrix.data)

    def test_observability_endpoint_returns_counts(self):
        LaboratoryEventLog.objects.create(event_type="ai_explain_failed", module="integral", payload={"error": "offline"})

        response = self.client.get(reverse("laboratory-observability"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["ai_failure_count"], 1)
        self.assertIn("job_counts", response.data)
        self.assertIn("recent_failures", response.data)
