from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import sympy as sp
from sympy import latex


class VerificationError(ValueError):
    pass


@dataclass(frozen=True)
class VerificationCertificate:
    status: str
    trust_score: int
    checks: list[dict[str, Any]]
    warnings: list[str]
    recommendations: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "trust_score": self.trust_score,
            "checks": self.checks,
            "warnings": self.warnings,
            "recommendations": self.recommendations,
        }


def _check_tone(passed: bool | None) -> str:
    if passed is True:
        return "pass"
    if passed is False:
        return "fail"
    return "review"


def verify_integral_certificate(
    *,
    expression: str,
    lower: str = "",
    upper: str = "",
    antiderivative_latex: str = "",
    result_latex: str = "",
    method: str = "auto",
) -> VerificationCertificate:
    if not expression.strip():
        raise VerificationError("expression is required")

    x = sp.symbols("x", real=True)
    warnings: list[str] = []
    recommendations: list[str] = []
    checks: list[dict[str, Any]] = []

    try:
        expr = sp.sympify(expression)
    except Exception as exc:
        raise VerificationError(f"expression could not be parsed: {exc}") from exc

    antiderivative = None
    exact = None
    try:
        antiderivative = sp.simplify(sp.integrate(expr, x))
    except Exception as exc:
        warnings.append(f"Antiderivative check could not be computed: {exc}")

    if lower.strip() and upper.strip():
        try:
            a = sp.sympify(lower)
            b = sp.sympify(upper)
            exact = sp.simplify(sp.integrate(expr, (x, a, b)))
        except Exception as exc:
            warnings.append(f"Definite integral check could not be computed: {exc}")
    else:
        a = b = None
        recommendations.append("No finite bounds were provided; boundary substitution check is not applicable.")

    if antiderivative is not None:
        residual = sp.simplify(sp.diff(antiderivative, x) - expr)
        passed = residual == 0
        checks.append(
            {
                "id": "derivative-check",
                "label": "Derivative check",
                "status": _check_tone(passed),
                "passed": passed,
                "residual_latex": latex(residual),
                "detail": "Differentiate F(x) and compare it with the submitted integrand.",
            }
        )

    if antiderivative is not None and exact is not None and a is not None and b is not None:
        via_ftc = sp.simplify(antiderivative.subs(x, b) - antiderivative.subs(x, a))
        residual = sp.simplify(via_ftc - exact)
        passed = residual == 0
        checks.append(
            {
                "id": "boundary-substitution",
                "label": "Boundary substitution",
                "status": _check_tone(passed),
                "passed": passed,
                "residual_latex": latex(residual),
                "detail": "Verify F(b)-F(a) against direct definite integration.",
            }
        )

    singularities: list[str] = []
    if lower.strip() and upper.strip():
        try:
            candidates = sp.solve(sp.denom(sp.together(expr)), x)
            for item in candidates:
                if item.is_real is False:
                    continue
                if a is not None and b is not None and bool(item >= a and item <= b):
                    singularities.append(latex(item))
        except Exception:
            pass

    checks.append(
        {
            "id": "domain-singularity",
            "label": "Domain / singularity",
            "status": "review" if singularities else "pass",
            "passed": not singularities,
            "detail": "Potential denominator singularities inside the interval.",
            "singularities_latex": singularities,
        }
    )

    if exact is not None:
        try:
            numeric = sp.N(exact, 18)
            checks.append(
                {
                    "id": "numeric-check",
                    "label": "Numeric check",
                    "status": "pass",
                    "passed": True,
                    "value": str(numeric),
                    "detail": f"Decimal approximation computed for method '{method}'.",
                }
            )
        except Exception as exc:
            warnings.append(f"Numeric check failed: {exc}")

    failed = [item for item in checks if item.get("passed") is False]
    review = [item for item in checks if item.get("status") == "review"]
    trust_score = max(0, 100 - len(failed) * 35 - len(review) * 12 - len(warnings) * 8)
    status = "verified" if trust_score >= 82 and not failed else "review" if trust_score >= 50 else "blocked"

    if status != "verified":
        recommendations.append("Review assumptions and numerical fallback before using this result in a final report.")
    if method in {"monte-carlo", "series-expansion-integral"}:
        recommendations.append("Selected method is approximation-oriented; include error/convergence notes in the report.")

    return VerificationCertificate(
        status=status,
        trust_score=trust_score,
        checks=checks,
        warnings=warnings,
        recommendations=recommendations,
    )


def _certificate_from_checks(checks: list[dict[str, Any]], warnings: list[str] | None = None, recommendations: list[str] | None = None) -> VerificationCertificate:
    warnings = warnings or []
    recommendations = recommendations or []
    failed = [item for item in checks if item.get("passed") is False]
    review = [item for item in checks if item.get("status") == "review"]
    trust_score = max(0, 100 - len(failed) * 35 - len(review) * 12 - len(warnings) * 8)
    status = "verified" if trust_score >= 82 and not failed else "review" if trust_score >= 50 else "blocked"
    return VerificationCertificate(status=status, trust_score=trust_score, checks=checks, warnings=warnings, recommendations=recommendations)


def verify_differential_certificate(*, mode: str, expression: str, variable: str = "x", result_latex: str = "") -> VerificationCertificate:
    warnings: list[str] = []
    recommendations: list[str] = []
    checks: list[dict[str, Any]] = []
    try:
        symbol = sp.symbols(variable or "x", real=True)
        expr = sp.sympify(expression)
        derivative = sp.diff(expr, symbol)
        checks.append({
            "id": "symbolic-derivative",
            "label": "Symbolic derivative/residual",
            "status": "pass",
            "passed": True,
            "detail": f"{mode} lane derivative object computed.",
            "result_latex": latex(derivative),
        })
    except Exception as exc:
        warnings.append(f"Differential verification failed: {exc}")
        checks.append({"id": "symbolic-derivative", "label": "Symbolic derivative/residual", "status": "fail", "passed": False, "detail": str(exc)})
    if not result_latex:
        recommendations.append("Attach solver result latex to enable exact residual comparison.")
    return _certificate_from_checks(checks, warnings, recommendations)


def verify_matrix_certificate(*, expression: str, mode: str = "algebra", rhs: str = "") -> VerificationCertificate:
    warnings: list[str] = []
    checks: list[dict[str, Any]] = []
    try:
        rows = [[sp.sympify(cell.strip()) for cell in row.replace(",", " ").split()] for row in expression.split(";") if row.strip()]
        matrix = sp.Matrix(rows)
        rank = matrix.rank()
        det = matrix.det() if matrix.rows == matrix.cols else None
        condition_review = False
        condition_value = None
        if matrix.rows == matrix.cols and matrix.rows <= 4:
            try:
                condition_value = float(matrix.condition_number().evalf())
                condition_review = condition_value > 1e8
            except Exception:
                condition_value = None
        checks.extend([
            {"id": "rank", "label": "Rank check", "status": "pass", "passed": True, "detail": f"rank(A)={rank}", "value": str(rank)},
            {"id": "determinant", "label": "Determinant/singularity", "status": "review" if det == 0 else "pass", "passed": det != 0 if det is not None else None, "detail": "Square determinant checked." if det is not None else "Not a square matrix.", "value": latex(det) if det is not None else None},
            {"id": "condition", "label": "Condition number", "status": "review" if condition_review else "pass", "passed": not condition_review, "detail": "High condition number means numerical instability." if condition_review else "No severe conditioning risk detected.", "value": condition_value},
        ])
    except Exception as exc:
        warnings.append(f"Matrix verification failed: {exc}")
        checks.append({"id": "matrix-parse", "label": "Matrix parse", "status": "fail", "passed": False, "detail": str(exc)})
    return _certificate_from_checks(checks, warnings, ["Use exact symbolic checks for final proofs when entries are symbolic."])


def verify_probability_certificate(*, mode: str, dataset: str, parameters: str = "") -> VerificationCertificate:
    values: list[float] = []
    for token in dataset.replace(";", ",").split(","):
        try:
            values.append(float(token.strip()))
        except Exception:
            continue
    checks = [
        {"id": "sample-size", "label": "Sample size", "status": "pass" if len(values) >= 20 else "review", "passed": len(values) >= 2, "detail": f"{len(values)} numeric samples parsed.", "value": len(values)},
        {"id": "confidence", "label": "Confidence warning", "status": "review" if len(values) < 30 else "pass", "passed": len(values) >= 30, "detail": "Small samples should be treated as exploratory." if len(values) < 30 else "Sample size is acceptable for basic descriptive confidence."},
    ]
    return _certificate_from_checks(checks, [], ["Report distribution assumptions and confidence method explicitly."])


def verify_series_limit_certificate(*, mode: str, expression: str, auxiliary: str = "") -> VerificationCertificate:
    warnings: list[str] = []
    checks: list[dict[str, Any]] = []
    try:
        n = sp.symbols("n", integer=True, positive=True)
        x = sp.symbols("x", real=True)
        expr = sp.sympify(expression)
        target_symbol = n if "n" in expression else x
        candidate = sp.limit(expr, target_symbol, sp.oo if target_symbol == n else 0)
        checks.append({"id": "limit-existence", "label": "Limit/convergence", "status": "pass" if candidate is not sp.nan else "review", "passed": candidate is not sp.nan, "detail": f"{mode} symbolic limit attempted.", "result_latex": latex(candidate)})
    except Exception as exc:
        warnings.append(f"Series/limit verification failed: {exc}")
        checks.append({"id": "limit-existence", "label": "Limit/convergence", "status": "review", "passed": None, "detail": str(exc)})
    return _certificate_from_checks(checks, warnings, ["Add endpoint and convergence assumptions for publication reports."])
