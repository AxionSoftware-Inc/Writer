"""
differential_lane_derivative.py

Handles ordinary derivative and higher-order derivative lanes.
Produces full step-by-step symbolic solution via SymPy.
"""
from __future__ import annotations

import sympy as sp
from sympy import latex, N as sympy_numeric

from .differential_lane_common import (
    DifferentialSolveResult,
    DifferentialSolverError,
    build_symbolic_lane_contract,
    build_derivative_steps,
    build_parser_payload,
    describe_differentiation_strategy,
    infer_differentiability,
    infer_singularity_points,
    infer_symbolic_taxonomy,
)
from .sympy_service import MathParserError, parse_user_math_input


def solve_derivative_lane(
    expression: str,
    variable: str,
    point: str,
    order: int = 1,
) -> DifferentialSolveResult:
    var_names = [v.strip() for v in variable.split(",") if v.strip()]
    if not var_names:
        raise DifferentialSolverError("O'zgaruvchi kiritilmadi.")

    primary_var = var_names[0]

    try:
        expr_input = parse_user_math_input(expression, label="Ifoda", variable_names=var_names)
    except MathParserError as exc:
        raise DifferentialSolverError(str(exc)) from exc

    sym_var = sp.Symbol(primary_var, real=True)
    f = expr_input.expression

    # Differentiability diagnostics
    diff_analysis = infer_differentiability(f, [sym_var])
    singularities = infer_singularity_points(f, [sym_var])

    # Compute symbolic derivative
    try:
        derivative = f
        for _ in range(order):
            derivative = sp.diff(derivative, sym_var)
        derivative = sp.simplify(derivative)
    except Exception as exc:
        raise DifferentialSolverError(f"SymPy hosila topishda xato: {exc}") from exc

    # Try to evaluate at point
    evaluated_latex: str | None = None
    numeric_approximation: str | None = None

    if point.strip():
        try:
            point_val = sp.sympify(
                point.strip(),
                locals={"pi": sp.pi, "e": sp.E, "oo": sp.oo},
            )
            evaluated = sp.simplify(derivative.subs(sym_var, point_val))
            evaluated_latex = f"f^{{({order})}}({latex(point_val)}) = {latex(evaluated)}"
            try:
                numeric_approximation = str(sympy_numeric(evaluated, 10))
            except Exception:
                pass
        except Exception:
            evaluated_latex = None

    method_meta = describe_differentiation_strategy(f)
    taxonomy = infer_symbolic_taxonomy(f, "derivative")
    parser_payload = build_parser_payload(
        expr_input=expr_input,
        var_str=variable,
        point_str=point,
    )

    steps = build_derivative_steps(
        expr_input=expr_input,
        variable=sym_var,
        derivative=derivative,
        order=order,
        evaluated_latex=evaluated_latex,
        numeric_approximation=numeric_approximation,
        method_meta=method_meta,
    )
    contract = build_symbolic_lane_contract(
        lane="derivative",
        family_hint=taxonomy["family"],
        continuity=diff_analysis.get("continuity"),
        differentiability=diff_analysis.get("differentiability"),
        blocker_count=len(diff_analysis.get("domain_analysis", {}).get("blockers", [])),
        hazard_count=len(singularities),
        review_notes=[
            f"Derivative order {order} was verified symbolically.",
            "Review singularity points before publication use." if singularities else "No isolated singularity points detected on the active symbolic lane.",
        ],
    )

    return DifferentialSolveResult(
        status="exact",
        message=f"{order}-tartibli hosila topildi.",
        payload={
            "input": {
                "expression": expression,
                "variable": variable,
                "point": point,
                "order": order,
                "lane": "derivative",
            },
            "parser": parser_payload,
            "diagnostics": {
                **diff_analysis,
                "singularity_points": singularities,
                "taxonomy": taxonomy,
                "contract": contract,
            },
            "exact": {
                "method_label": method_meta["label"],
                "derivative_latex": latex(derivative),
                "evaluated_latex": evaluated_latex,
                "numeric_approximation": numeric_approximation,
                "taxonomy_family": taxonomy["family"],
                "steps": steps,
            },
        },
    )
