"""
differential_lane_common.py

Shared data structures, parser utilities, and step builders
for all Differential Studio backend lanes.

Mirrors the architecture of integral_lane_common.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import sympy as sp
from sympy import latex, simplify, denom, solveset, Eq, FiniteSet, S, Symbol
from sympy import sin, cos, tan, exp, log, sqrt, Abs, sign, Piecewise, Max, Min, asin, acos
from sympy.core.power import Pow

from .sympy_service import ParsedMathInput


class DifferentialSolverError(ValueError):
    pass


@dataclass
class DifferentialSolveResult:
    status: str          # "exact" | "needs_numerical"
    message: str
    payload: dict[str, Any]


def finalize_lane_contract(
    *,
    status: str,
    checks: list[dict[str, str]],
    completeness: str,
    family_hint: str,
    blocker_count: int = 0,
    hazard_count: int = 0,
    review_notes: list[str] | None = None,
    discretization: str | None = None,
) -> dict[str, Any]:
    review_notes = list(review_notes or [])

    if status == "error":
        risk_level = "high"
        readiness_label = "blocked"
    elif status == "warn":
        risk_level = "high" if blocker_count or hazard_count >= 2 else "medium"
        readiness_label = "research_review"
    elif status == "info":
        risk_level = "medium" if blocker_count or hazard_count else "low"
        readiness_label = "working"
    else:
        risk_level = "low" if blocker_count == 0 and hazard_count == 0 else "medium"
        readiness_label = "publication_ready" if completeness in {"complete", "profiled"} and blocker_count == 0 else "research_review"

    return {
        "status": status,
        "checks": checks,
        "completeness": completeness,
        "family_hint": family_hint,
        "discretization": discretization,
        "risk_level": risk_level,
        "readiness_label": readiness_label,
        "blocker_count": blocker_count,
        "hazard_count": hazard_count,
        "review_notes": review_notes,
    }


def build_symbolic_lane_contract(
    *,
    lane: str,
    family_hint: str,
    continuity: str | None = None,
    differentiability: str | None = None,
    blocker_count: int = 0,
    hazard_count: int = 0,
    matrix_shape: str | None = None,
    review_notes: list[str] | None = None,
) -> dict[str, Any]:
    checks: list[dict[str, str]] = [
        {"id": "lane", "label": "Analysis lane", "status": "ok", "detail": lane},
    ]

    if continuity:
        checks.append(
            {
                "id": "continuity",
                "label": "Continuity",
                "status": "warn" if continuity != "continuous" else "ok",
                "detail": continuity,
            }
        )
    if differentiability:
        checks.append(
            {
                "id": "differentiability",
                "label": "Differentiability",
                "status": "ok" if differentiability == "differentiable" else "warn",
                "detail": differentiability,
            }
        )
    if matrix_shape:
        checks.append(
            {
                "id": "matrix_shape",
                "label": "Matrix shape",
                "status": "ok",
                "detail": matrix_shape,
            }
        )

    status = "ok"
    completeness = "complete"
    if differentiability == "partial" or hazard_count:
        status = "info"
        completeness = "profiled"
    if differentiability == "non_differentiable" or blocker_count:
        status = "warn"
        completeness = "profiled"

    return finalize_lane_contract(
        status=status,
        checks=checks,
        completeness=completeness,
        family_hint=family_hint,
        blocker_count=blocker_count,
        hazard_count=hazard_count,
        review_notes=review_notes,
    )


# ─── Domain analysis ──────────────────────────────────────────────────────────

def _format_latex(expr: Any) -> str:
    try:
        return latex(simplify(expr))
    except Exception:
        return str(expr)


def infer_differentiability(expression: Any, sym_vars: list[Symbol]) -> dict[str, Any]:
    """
    Heuristic differentiability analysis.
    Returns continuity, differentiability label, and domain constraints.
    """
    constraints: list[dict[str, str]] = []
    assumptions: list[str] = []
    blockers: list[str] = []
    continuity = "continuous"
    differentiability = "differentiable"

    # Denominator poles
    try:
        d = simplify(denom(expression))
        if d != 1:
            d_text = _format_latex(d)
            constraints.append({
                "kind": "denominator_nonzero",
                "label": "Pole avoidance",
                "detail": f"{d_text} ≠ 0",
                "severity": "blocker",
            })
            # Try to find poles
            for v in sym_vars:
                try:
                    roots = solveset(Eq(d, 0), v, domain=S.Reals)
                    if isinstance(roots, FiniteSet) and roots:
                        for root in roots:
                            blockers.append(f"{v} = {_format_latex(root)}")
                except Exception:
                    pass
            continuity = "discontinuous"
            differentiability = "non_differentiable"
    except Exception:
        pass

    # Log domain
    for log_atom in expression.atoms(log):
        arg_text = _format_latex(log_atom.args[0])
        constraints.append({
            "kind": "log_argument_positive",
            "label": "Log domain",
            "detail": f"{arg_text} > 0",
            "severity": "blocker",
        })

    # Inverse trig domains
    for asin_atom in expression.atoms(asin):
        arg_text = _format_latex(asin_atom.args[0])
        constraints.append({
            "kind": "asin_argument_domain",
            "label": "asin domain",
            "detail": f"-1 \\le {arg_text} \\le 1",
            "severity": "blocker",
        })

    for acos_atom in expression.atoms(acos):
        arg_text = _format_latex(acos_atom.args[0])
        constraints.append({
            "kind": "acos_argument_domain",
            "label": "acos domain",
            "detail": f"-1 \\le {arg_text} \\le 1",
            "severity": "blocker",
        })

    # Tangent poles
    for tan_atom in expression.atoms(tan):
        arg_text = _format_latex(tan_atom.args[0])
        constraints.append({
            "kind": "tan_poles",
            "label": "Trig pole avoidance",
            "detail": f"\\cos({arg_text}) \\ne 0",
            "severity": "blocker",
        })

    # Even roots
    for pow_atom in expression.atoms(Pow):
        exp_val = pow_atom.exp
        if getattr(exp_val, "is_Rational", False) and getattr(exp_val, "q", 1) % 2 == 0:
            base_text = _format_latex(pow_atom.base)
            constraints.append({
                "kind": "even_root_radicand",
                "label": "Root domain",
                "detail": f"{base_text} ≥ 0",
                "severity": "blocker",
            })

    # Abs / sign → non-differentiable at zero
    if expression.has(Abs):
        assumptions.append("Abs() structure: non-differentiable at the zero boundary.")
        differentiability = "partial"

    if expression.has(sign):
        assumptions.append("sign() structure: discontinuous derivative at zero.")
        differentiability = "non_differentiable"

    if expression.has(Piecewise):
        assumptions.append("Explicit Piecewise: differentiability depends on branch conditions.")
        differentiability = "partial"

    return {
        "continuity": continuity,
        "differentiability": differentiability,
        "domain_analysis": {
            "constraints": constraints,
            "assumptions": assumptions,
            "blockers": blockers,
        },
    }


def infer_singularity_points(expression: Any, sym_vars: list[Symbol]) -> list[dict[str, str]]:
    """Find isolated singularity points for each variable."""
    singularities: list[dict[str, str]] = []
    try:
        d = simplify(denom(expression))
        if d != 1:
            for v in sym_vars:
                try:
                    roots = solveset(Eq(d, 0), v, domain=S.Reals)
                    if isinstance(roots, FiniteSet):
                        for root in roots:
                            singularities.append({
                                "variable": str(v),
                                "point": _format_latex(root),
                                "kind": "pole",
                            })
                except Exception:
                    pass
    except Exception:
        pass
    return singularities


def infer_symbolic_taxonomy(expression: Any, lane: str) -> dict[str, Any]:
    tags: list[str] = []
    family = "general_symbolic"
    summary = "General symbolic differentiation pipeline."

    if expression.is_polynomial():
        family = "polynomial"
        summary = "Polynomial structure dominates the active lane."
        tags.extend(["power_rule", "algebraic"])
    elif expression.has(exp):
        family = "exponential"
        summary = "Exponential response controls the local differential behaviour."
        tags.extend(["chain_rule", "exponential"])
    elif expression.has(sin) or expression.has(cos) or expression.has(tan):
        family = "trigonometric"
        summary = "Trigonometric structure is active; periodic response and chain-rule logic dominate."
        tags.extend(["trigonometric", "chain_rule"])
    elif expression.has(log):
        family = "logarithmic"
        summary = "Logarithmic structure introduces domain-sensitive differentiation."
        tags.extend(["logarithmic", "domain_sensitive"])
    elif expression.has(Abs) or expression.has(Piecewise) or expression.has(sign) or expression.has(Max) or expression.has(Min):
        family = "piecewise"
        summary = "Piecewise or non-smooth structure is present."
        tags.extend(["piecewise", "non_smooth"])

    if lane == "directional":
        tags.append("projection")
    if lane == "jacobian":
        tags.append("local_linearization")
    if lane == "hessian":
        tags.append("curvature")

    return {
        "lane": lane,
        "family": family,
        "tags": sorted(set(tags)),
        "summary": summary,
    }


# ─── Parser payload builder ───────────────────────────────────────────────────

def build_parser_payload(
    *,
    expr_input: ParsedMathInput,
    var_str: str,
    point_str: str,
) -> dict[str, Any]:
    return {
        "expression_raw": expr_input.raw,
        "expression_normalized": expr_input.normalized,
        "expression_latex": expr_input.latex,
        "variable": var_str,
        "point_raw": point_str,
        "point_normalized": point_str.strip(),
        "notes": expr_input.notes,
    }


# ─── Step builders ────────────────────────────────────────────────────────────

def describe_differentiation_strategy(expression: Any) -> dict[str, str]:
    """Label the symbolic differentiation strategy used."""
    if expression.is_polynomial():
        return {"label": "Power Rule", "summary": "Polinomial tuzilish: kuchlar qoidasi bilan hosila topildi."}
    if expression.has(exp):
        return {"label": "Exponential Rule", "summary": "Eksponentsial tuzilish: d/dx[eˣ] = eˣ qoidasi ishlatildi."}
    if expression.has(sin) or expression.has(cos) or expression.has(tan):
        return {"label": "Trig Chain Rule", "summary": "Trigonometrik tuzilish: hosila zanjir qoidasi bilan topildi."}
    if expression.has(log):
        return {"label": "Logarithmic Rule", "summary": "Logarifmik tuzilish: d/dx[ln(u)] = u'/u qoidasi."}
    if expression.has(sqrt):
        return {"label": "Root Power Rule", "summary": "Ildiz: d/dx[√u] = 1/(2√u) · u' qoidasi."}
    if expression.has(Abs):
        return {"label": "Piecewise Derivative", "summary": "Abs() tuzilish: d/dx[|u|] = sign(u)·u' (u≠0 da)."}
    return {"label": "Symbolic Reduction", "summary": "SymPy umumiy symbolic reduction bilan hosila topdi."}


def build_derivative_steps(
    *,
    expr_input: ParsedMathInput,
    variable: Symbol,
    derivative: Any,
    order: int,
    evaluated_latex: str | None,
    numeric_approximation: str | None,
    method_meta: dict[str, str],
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {
            "title": "Parser Translation",
            "summary": "Foydalanuvchi yozuvi SymPy uchun normalizatsiya qilindi.",
            "latex": f"f({variable}) = {expr_input.latex}",
            "tone": "neutral",
        },
        {
            "title": "Method Detection",
            "summary": f"{method_meta['label']}: {method_meta['summary']}",
            "latex": None,
            "tone": "info",
        },
        {
            "title": f"Derivative (order {order})",
            "summary": f"{'d' * order}/d{variable}{'ⁿ' if order > 1 else ''} SymPy orqali topildi.",
            "latex": f"f^{{({order})}}({variable}) = {latex(derivative)}",
            "tone": "info",
        },
    ]

    if evaluated_latex:
        steps.append({
            "title": "Point Evaluation",
            "summary": f"Hosila berilgan nuqtada baholandi.",
            "latex": evaluated_latex,
            "tone": "success",
        })

    if numeric_approximation:
        steps.append({
            "title": "Numeric Approximation",
            "summary": "Decimal ko'rinish.",
            "latex": f"\\approx {numeric_approximation}",
            "tone": "neutral",
        })

    return steps


def build_gradient_steps(
    *,
    expr_input: ParsedMathInput,
    sym_vars: list[Symbol],
    partials: list[Any],
    gradient_latex: str,
    evaluated_at_point: str | None,
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {
            "title": "Parser Translation",
            "summary": "Ifoda normalizatsiya qilindi.",
            "latex": f"f = {expr_input.latex}",
            "tone": "neutral",
        },
    ]

    for i, (v, partial) in enumerate(zip(sym_vars, partials)):
        steps.append({
            "title": f"Partial ∂f/∂{v}",
            "summary": f"{v} o'zgaruvchisi bo'yicha qisman hosila.",
            "latex": f"\\frac{{\\partial f}}{{\\partial {v}}} = {latex(partial)}",
            "tone": "info",
        })

    steps.append({
        "title": "Gradient Vector",
        "summary": "Barcha qisman hosilalar gradient vektori sifatida yig'ildi.",
        "latex": gradient_latex,
        "tone": "success",
    })

    if evaluated_at_point:
        steps.append({
            "title": "Evaluated at Point",
            "summary": "Gradient berilgan nuqtada baholandi.",
            "latex": evaluated_at_point,
            "tone": "success",
        })

    return steps


def build_jacobian_steps(
    *,
    expr_input: ParsedMathInput,
    sym_vars: list[Symbol],
    jacobian_latex: str,
    det_latex: str | None,
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {
            "title": "Parser Translation",
            "summary": "Vektor funksiya normalizatsiya qilindi.",
            "latex": f"F = {expr_input.latex}",
            "tone": "neutral",
        },
        {
            "title": "Jacobian Construction",
            "summary": "J[i][j] = ∂Fᵢ/∂xⱼ matritsasi barcha qisman hosilalardan tuzildi.",
            "latex": jacobian_latex,
            "tone": "success",
        },
    ]

    if det_latex:
        steps.append({
            "title": "Determinant",
            "summary": "Kvadrat Jacobian uchun determinant, local lokal ko'rsatkich.",
            "latex": det_latex,
            "tone": "info",
        })

    return steps


def build_hessian_steps(
    *,
    expr_input: ParsedMathInput,
    sym_vars: list[Symbol],
    hessian_latex: str,
    det_latex: str | None,
    classification_label: str,
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {
            "title": "Parser Translation",
            "summary": "Scalar maydon normalizatsiya qilindi.",
            "latex": f"f = {expr_input.latex}",
            "tone": "neutral",
        },
    ]

    n = len(sym_vars)
    for i in range(n):
        for j in range(n):
            label = (
                f"∂²f/∂{sym_vars[i]}²"
                if i == j
                else f"∂²f/∂{sym_vars[i]}∂{sym_vars[j]}"
            )
            steps.append({
                "title": label,
                "summary": "3-nuqta stensili (diagonal) yoki 4-nuqta stensili (off-diagonal).",
                "latex": None,
                "tone": "neutral",
            })

    steps.append({
        "title": "Hessian Matrix",
        "summary": "Barcha ikkinchi tartibli qisman hosilalar matritsaga yig'ildi.",
        "latex": hessian_latex,
        "tone": "success",
    })

    if det_latex:
        steps.append({
            "title": "Determinant & Classification",
            "summary": f"Kritik nuqta turi: {classification_label}",
            "latex": det_latex,
            "tone": "info",
        })

    return steps
