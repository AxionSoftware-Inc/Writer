"""
differential_lane_jacobian.py

Handles Jacobian matrix lane: F: Rⁿ → Rᵐ vector field.
Produces full symbolic J matrix with determinant (if square).
"""
from __future__ import annotations

import sympy as sp
from sympy import latex, N as sympy_numeric

from .differential_lane_common import (
    DifferentialSolveResult,
    DifferentialSolverError,
    build_symbolic_lane_contract,
    build_jacobian_steps,
    build_parser_payload,
    infer_differentiability,
    infer_symbolic_taxonomy,
)
from .sympy_service import MathParserError, parse_user_math_input


def _parse_vector_expression(expression: str, var_names: list[str]) -> list[sp.Expr]:
    """
    Parse [f1, f2, f3, ...] or f1, f2, f3 into list of SymPy expressions.
    """
    cleaned = expression.strip()
    if cleaned.startswith("[") and cleaned.endswith("]"):
        cleaned = cleaned[1:-1]

    # We need to split by top-level commas (not inside parens)
    parts: list[str] = []
    depth = 0
    current = ""
    for ch in cleaned:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current.strip())

    parsed_list: list[sp.Expr] = []
    for part in parts:
        try:
            inp = parse_user_math_input(part, label=f"F_component", variable_names=var_names)
            parsed_list.append(inp.expression)
        except MathParserError as exc:
            raise DifferentialSolverError(f"Jacobian komponenti o'qilmadi: {exc}") from exc

    return parsed_list


def solve_jacobian_lane(
    expression: str,
    variable: str,
    point: str,
) -> DifferentialSolveResult:
    var_names = [v.strip() for v in variable.split(",") if v.strip()]
    if not var_names:
        raise DifferentialSolverError("O'zgaruvchi(lar) kiritilmadi.")

    func_exprs = _parse_vector_expression(expression, var_names)
    if not func_exprs:
        raise DifferentialSolverError("Jacobian uchun kamida bitta funksiya kerak.")

    sym_vars = [sp.Symbol(v, real=True) for v in var_names]

    # Build Jacobian matrix
    try:
        F_matrix = sp.Matrix(func_exprs)
        J = F_matrix.jacobian(sym_vars)
        J_simplified = J.applyfunc(sp.simplify)
    except Exception as exc:
        raise DifferentialSolverError(f"Jacobian hisoblashda xato: {exc}") from exc

    jacobian_latex = rf"J = {latex(J_simplified)}"

    # Determinant (only if square)
    m, n = J_simplified.shape
    det_latex: str | None = None
    det_numeric: str | None = None
    determinant_status = "not_applicable"
    if m == n:
        try:
            det_val = sp.simplify(J_simplified.det())
            det_latex = rf"\det(J) = {latex(det_val)}"
            det_numeric = str(sympy_numeric(det_val, 8))
            det_float = float(sympy_numeric(det_val, 8))
            determinant_status = "near_singular" if abs(det_float) < 1e-6 else "invertible"
        except Exception:
            det_latex = None
            determinant_status = "not_applicable"

    # Evaluate at point
    evaluated_latex: str | None = None
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
                J_eval = J_simplified.subs(subs_map).applyfunc(sp.simplify)
                evaluated_latex = rf"J\big|_{{p}} = {latex(J_eval)}"
        except Exception:
            pass

    # Differentiability from first component
    diff_analysis = {}
    if func_exprs:
        try:
            diff_analysis = infer_differentiability(func_exprs[0], sym_vars)
        except Exception:
            diff_analysis = {}
    taxonomy = infer_symbolic_taxonomy(func_exprs[0] if func_exprs else sp.Integer(0), "jacobian")

    # Build combined latex for expr_input
    combined_expr_latex = ", ".join(latex(f) for f in func_exprs)
    combined_expr_column = r" \\ ".join(latex(f) for f in func_exprs)
    vector_latex = rf"\mathbf{{F}} = \begin{{bmatrix}} {combined_expr_column} \end{{bmatrix}}"

    parser_payload = {
        "expression_raw": expression,
        "expression_normalized": expression.strip(),
        "expression_latex": vector_latex,
        "variable": variable,
        "point_raw": point,
        "point_normalized": point.strip(),
        "notes": [],
    }

    steps = build_jacobian_steps(
        expr_input=type("_", (), {
            "raw": expression,
            "normalized": expression.strip(),
            "expression": None,
            "latex": vector_latex,
            "notes": [],
        })(),
        sym_vars=sym_vars,
        jacobian_latex=jacobian_latex,
        det_latex=det_latex,
    )
    contract = build_symbolic_lane_contract(
        lane="jacobian",
        family_hint=taxonomy["family"],
        continuity=diff_analysis.get("continuity"),
        differentiability=diff_analysis.get("differentiability"),
        matrix_shape=f"{m}x{n}",
        blocker_count=len(diff_analysis.get("domain_analysis", {}).get("blockers", [])),
        hazard_count=1 if determinant_status == "near_singular" else 0,
        review_notes=[
            "Jacobian matrix was assembled symbolically from the supplied vector field.",
            "Near-singular determinant suggests local invertibility should be reviewed." if determinant_status == "near_singular" else "Matrix determinant does not indicate a near-singular local map.",
        ],
    )

    return DifferentialSolveResult(
        status="exact",
        message="Jacobian matritsasi topildi.",
        payload={
            "input": {
                "expression": expression,
                "variable": variable,
                "point": point,
                "lane": "jacobian",
                "size": {"rows": m, "cols": n},
            },
            "parser": parser_payload,
            "diagnostics": {
                **diff_analysis,
                "taxonomy": taxonomy,
                "matrix": {
                    "lane": "jacobian",
                    "shape": f"{m}x{n}",
                    "square": m == n,
                    "determinant_status": determinant_status,
                },
                "contract": contract,
            },
            "exact": {
                "method_label": "Symbolic Jacobian",
                "derivative_latex": jacobian_latex,
                "evaluated_latex": evaluated_latex,
                "numeric_approximation": det_numeric,
                "determinant_latex": det_latex,
                "taxonomy_family": taxonomy["family"],
                "steps": steps,
            },
        },
    )
