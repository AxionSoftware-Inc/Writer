"""
differential_lane_gradient.py

Handles gradient (partial derivative) lane for scalar fields f: Rⁿ → R.
Produces full symbolic ∇f via SymPy.
"""
from __future__ import annotations

import sympy as sp
from sympy import latex, N as sympy_numeric

from .differential_lane_common import (
    DifferentialSolveResult,
    DifferentialSolverError,
    build_symbolic_lane_contract,
    build_gradient_steps,
    build_parser_payload,
    infer_differentiability,
    infer_singularity_points,
    infer_symbolic_taxonomy,
)
from .sympy_service import MathParserError, parse_user_math_input


def solve_gradient_lane(
    expression: str,
    variable: str,
    point: str,
    mode: str = "gradient",
    direction: str = "",
    coordinates: str = "cartesian",
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

    diff_analysis = infer_differentiability(f, sym_vars)
    singularities = infer_singularity_points(f, sym_vars)
    taxonomy = infer_symbolic_taxonomy(f, "directional" if mode == "directional" else "gradient")

    # Compute symbolic gradient
    try:
        partials = [sp.simplify(sp.diff(f, v)) for v in sym_vars]
    except Exception as exc:
        raise DifferentialSolverError(f"Gradient hisoblashda xato: {exc}") from exc

    gradient_col = r" \\ ".join(latex(p) for p in partials)
    gradient_latex = rf"\nabla f = \begin{{bmatrix}} {gradient_col} \end{{bmatrix}}"

    # Evaluate at point
    evaluated_at_point: str | None = None
    gradient_numeric: list[str] = []
    directional_latex: str | None = None
    directional_numeric: str | None = None
    unit_direction_latex: str | None = None
    direction_values: list[sp.Expr] = []
    directional_evaluated_latex: str | None = None

    if point.strip():
        try:
            locals_map = {"pi": sp.pi, "e": sp.E, "oo": sp.oo}
            pts = [
                sp.sympify(p.strip(), locals=locals_map)
                for p in point.split(",")
                if p.strip()
            ]
            if len(pts) == len(sym_vars):
                subs_map = dict(zip(sym_vars, pts))
                eval_vals = [sp.simplify(p.subs(subs_map)) for p in partials]
                col = r" \\ ".join(latex(v) for v in eval_vals)
                point_latex = ", ".join(latex(p) for p in pts)
                evaluated_at_point = rf"\nabla f({point_latex}) = \begin{{bmatrix}} {col} \end{{bmatrix}}"
                for v in eval_vals:
                    try:
                        gradient_numeric.append(str(sympy_numeric(v, 8)))
                    except Exception:
                        gradient_numeric.append("?")
        except Exception:
            pass

    if mode == "directional":
        locals_map = {"pi": sp.pi, "e": sp.E, "oo": sp.oo}
        try:
            direction_values = [
                sp.sympify(item.strip(), locals=locals_map)
                for item in direction.split(",")
                if item.strip()
            ]
        except Exception as exc:
            raise DifferentialSolverError(f"Direction vector o'qilmadi: {exc}") from exc

        if not direction_values or len(direction_values) != len(sym_vars):
            raise DifferentialSolverError("Directional derivative uchun direction vektori o'zgaruvchilar soniga mos bo'lishi kerak.")

        norm_sq = sum(sp.simplify(item ** 2) for item in direction_values)
        if sp.simplify(norm_sq) == 0:
            raise DifferentialSolverError("Directional derivative uchun direction vektori nol bo'lmasligi kerak.")

        norm = sp.sqrt(norm_sq)
        unit_direction = [sp.simplify(item / norm) for item in direction_values]
        unit_direction_col = r" \\ ".join(latex(item) for item in unit_direction)
        unit_direction_latex = rf"\hat{{u}} = \begin{{bmatrix}} {unit_direction_col} \end{{bmatrix}}"
        directional_expr = sp.simplify(sum(partials[i] * unit_direction[i] for i in range(len(sym_vars))))
        directional_latex = rf"D_{{\hat{{u}}}} f = {latex(directional_expr)}"

        if point.strip():
            try:
                pts = [
                    sp.sympify(p.strip(), locals=locals_map)
                    for p in point.split(",")
                    if p.strip()
                ]
                if len(pts) == len(sym_vars):
                    subs_map = dict(zip(sym_vars, pts))
                    directional_eval = sp.simplify(directional_expr.subs(subs_map))
                    point_latex = ", ".join(latex(p) for p in pts)
                    directional_evaluated_latex = rf"D_{{\hat{{u}}}} f({point_latex}) = {latex(directional_eval)}"
                    directional_numeric = str(sympy_numeric(directional_eval, 8))
            except Exception:
                pass

    parser_payload = build_parser_payload(
        expr_input=expr_input,
        var_str=variable,
        point_str=point,
    )

    steps = build_gradient_steps(
        expr_input=expr_input,
        sym_vars=sym_vars,
        partials=partials,
        gradient_latex=gradient_latex,
        evaluated_at_point=evaluated_at_point,
    )

    if mode == "directional":
        steps.append({
            "title": "Direction Normalization",
            "summary": "Yo'nalish vektori birlik uzunlikka normallashtirildi.",
            "latex": unit_direction_latex,
            "tone": "info",
        })
        steps.append({
            "title": "Directional Projection",
            "summary": "Directional derivative gradientning unit direction bilan skalyar ko'paytmasi sifatida topildi.",
            "latex": directional_latex,
            "tone": "success",
        })
        if directional_evaluated_latex:
            steps.append({
                "title": "Directional Evaluation",
                "summary": "Directional derivative berilgan nuqtada baholandi.",
                "latex": directional_evaluated_latex,
                "tone": "success",
            })

    family_hint = taxonomy["family"]
    review_notes = [
        "Gradient components were constructed symbolically for the active coordinate system.",
    ]
    if mode == "directional":
        review_notes.append("Directional rate depends on the normalized direction vector and should be reported with that direction.")
    contract = build_symbolic_lane_contract(
        lane="directional" if mode == "directional" else "gradient",
        family_hint=family_hint,
        continuity=diff_analysis.get("continuity"),
        differentiability=diff_analysis.get("differentiability"),
        blocker_count=len(diff_analysis.get("domain_analysis", {}).get("blockers", [])),
        hazard_count=len(singularities),
        review_notes=review_notes,
    )

    return DifferentialSolveResult(
        status="exact",
        message="Directional derivative aniq topildi." if mode == "directional" else "Gradient aniq topildi.",
        payload={
            "input": {
                "expression": expression,
                "variable": variable,
                "point": point,
                "direction": direction,
                "coordinates": coordinates,
                "lane": "directional" if mode == "directional" else "gradient",
            },
            "parser": parser_payload,
            "diagnostics": {
                **diff_analysis,
                "singularity_points": singularities,
                "taxonomy": taxonomy,
                "directional": {
                    "active": mode == "directional",
                    "raw_direction": direction,
                    "normalized_direction_latex": unit_direction_latex,
                },
                "contract": contract,
            },
            "exact": {
                "method_label": "Symbolic Directional Derivative" if mode == "directional" else "Symbolic Gradient",
                "derivative_latex": directional_latex if mode == "directional" else gradient_latex,
                "evaluated_latex": directional_evaluated_latex if mode == "directional" else evaluated_at_point,
                "numeric_approximation": directional_numeric if mode == "directional" else (", ".join(gradient_numeric) if gradient_numeric else None),
                "taxonomy_family": taxonomy["family"],
                "steps": steps,
            },
        },
    )
