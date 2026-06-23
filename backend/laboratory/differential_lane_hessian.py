"""
differential_lane_hessian.py

Handles Hessian matrix lane: f: Rⁿ → R scalar field.
Produces full symbolic H with determinant, trace, and
definiteness classification (min/max/saddle/degenerate).
"""
from __future__ import annotations

import sympy as sp
from sympy import latex, N as sympy_numeric

from .differential_lane_common import (
    DifferentialSolveResult,
    DifferentialSolverError,
    build_symbolic_lane_contract,
    build_hessian_steps,
    build_parser_payload,
    infer_differentiability,
    infer_singularity_points,
    infer_symbolic_taxonomy,
)
from .sympy_service import MathParserError, parse_user_math_input


def _classify_hessian(H: sp.Matrix, n: int) -> tuple[str, str]:
    """
    Classify Hessian definiteness via leading principal minors (Sylvester's criterion).
    Returns (eigenvalue_signature, critical_point_type).
    """
    try:
        # For 1x1
        if n == 1:
            h11 = H[0, 0]
            val = float(sympy_numeric(h11, 6))
            if val > 0:
                return "positive_definite", "Local minimum"
            if val < 0:
                return "negative_definite", "Local maximum"
            return "semidefinite", "Degenerate (second-order test inconclusive)"

        # For 2x2: use det and H[0,0]
        if n == 2:
            h11 = float(sympy_numeric(H[0, 0], 6))
            det = float(sympy_numeric(H.det(), 6))
            if det > 0 and h11 > 0:
                return "positive_definite", "Local minimum"
            if det > 0 and h11 < 0:
                return "negative_definite", "Local maximum"
            if det < 0:
                return "indefinite", "Saddle point"
            return "semidefinite", "Degenerate (second-order test inconclusive)"

        # For n >= 3: compute leading principal minors
        minors_positive: list[bool] = []
        for k in range(1, n + 1):
            sub = H[:k, :k]
            try:
                d = float(sympy_numeric(sub.det(), 6))
                minors_positive.append(d > 0)
            except Exception:
                return "unknown", "Classification pending (symbolic)"

        if all(minors_positive):
            return "positive_definite", "Local minimum"
        if all(m == (i % 2 == 0) for i, m in enumerate(minors_positive)):
            return "negative_definite", "Local maximum"
        return "indefinite", "Saddle point"

    except Exception:
        return "unknown", "Classification pending"


def solve_hessian_lane(
    expression: str,
    variable: str,
    point: str,
) -> DifferentialSolveResult:
    var_names = [v.strip() for v in variable.split(",") if v.strip()]
    if not var_names:
        raise DifferentialSolverError("O'zgaruvchi(lar) kiritilmadi.")

    try:
        expr_input = parse_user_math_input(expression, label="Ifoda", variable_names=var_names)
    except MathParserError as exc:
        raise DifferentialSolverError(str(exc)) from exc

    sym_vars = [sp.Symbol(v, real=True) for v in var_names]
    f = expr_input.expression
    n = len(sym_vars)

    diff_analysis = infer_differentiability(f, sym_vars)
    singularities = infer_singularity_points(f, sym_vars)
    taxonomy = infer_symbolic_taxonomy(f, "hessian")

    # Build symbolic Hessian
    try:
        H = sp.hessian(f, sym_vars)
        H_simplified = H.applyfunc(sp.simplify)
    except Exception as exc:
        raise DifferentialSolverError(f"Hessian hisoblashda xato: {exc}") from exc

    hessian_latex = rf"H = {latex(H_simplified)}"

    # Determinant and trace
    det_latex: str | None = None
    det_numeric: str | None = None
    trace_numeric: str | None = None
    eigenvalue_signature = "unknown"
    critical_point_type = "Classification pending"
    determinant_status = "not_applicable"

    try:
        det_val = sp.simplify(H_simplified.det())
        trace_val = H_simplified.trace()
        det_latex = rf"\det(H) = {latex(det_val)}, \quad \operatorname{{tr}}(H) = {latex(trace_val)}"
        det_numeric = str(sympy_numeric(det_val, 8))
        trace_numeric = str(sympy_numeric(trace_val, 8))
        det_float = float(sympy_numeric(det_val, 8))
        if abs(det_float) < 1e-6:
            determinant_status = "near_singular"
        else:
            determinant_status = "invertible"
    except Exception:
        pass

    # Evaluate at point to classify
    H_at_point: sp.Matrix | None = None
    if point.strip():
        try:
            locals_map = {"pi": sp.pi, "e": sp.E, "oo": sp.oo}
            pts = [
                sp.sympify(p.strip(), locals=locals_map)
                for p in point.split(",")
                if p.strip()
            ]
            if len(pts) == n:
                subs_map = dict(zip(sym_vars, pts))
                H_at_point = H_simplified.subs(subs_map).applyfunc(sp.simplify)
                eigenvalue_signature, critical_point_type = _classify_hessian(H_at_point, n)
        except Exception:
            pass

    # Use symbolic H for classification if no point given
    if eigenvalue_signature == "unknown" and H_at_point is None:
        try:
            eigenvalue_signature, critical_point_type = _classify_hessian(H_simplified, n)
        except Exception:
            pass

    parser_payload = build_parser_payload(
        expr_input=expr_input,
        var_str=variable,
        point_str=point,
    )

    steps = build_hessian_steps(
        expr_input=expr_input,
        sym_vars=sym_vars,
        hessian_latex=hessian_latex,
        det_latex=det_latex,
        classification_label=critical_point_type,
    )
    contract = build_symbolic_lane_contract(
        lane="hessian",
        family_hint=taxonomy["family"],
        continuity=diff_analysis.get("continuity"),
        differentiability=diff_analysis.get("differentiability"),
        matrix_shape=f"{n}x{n}",
        blocker_count=len(diff_analysis.get("domain_analysis", {}).get("blockers", [])),
        hazard_count=(1 if determinant_status == "near_singular" else 0) + len(singularities),
        review_notes=[
            f"Second-order classification: {critical_point_type}.",
            "Curvature classification is numerically delicate near degenerate determinants." if determinant_status == "near_singular" else "Hessian determinant is away from the near-singular threshold.",
        ],
    )

    return DifferentialSolveResult(
        status="exact",
        message="Hessian matritsasi topildi.",
        payload={
            "input": {
                "expression": expression,
                "variable": variable,
                "point": point,
                "lane": "hessian",
                "size": n,
            },
            "parser": parser_payload,
            "diagnostics": {
                **diff_analysis,
                "singularity_points": singularities,
                "taxonomy": taxonomy,
                "matrix": {
                    "lane": "hessian",
                    "shape": f"{n}x{n}",
                    "square": True,
                    "determinant_status": determinant_status,
                    "critical_point_type": critical_point_type,
                    "eigenvalue_signature": eigenvalue_signature,
                },
                "contract": contract,
            },
            "exact": {
                "method_label": "Symbolic Hessian",
                "derivative_latex": hessian_latex,
                "evaluated_latex": det_latex,
                "numeric_approximation": det_numeric,
                "determinant_latex": det_latex,
                "eigenvalue_signature": eigenvalue_signature,
                "critical_point_type": critical_point_type,
                "trace_numeric": trace_numeric,
                "taxonomy_family": taxonomy["family"],
                "steps": steps,
            },
        },
    )
