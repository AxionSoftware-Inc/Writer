from __future__ import annotations

import re

import sympy as sp
from sympy import Eq, Function, Symbol, dsolve, latex

from .differential_lane_common import (
    DifferentialSolveResult,
    DifferentialSolverError,
    finalize_lane_contract,
    infer_symbolic_taxonomy,
)
from .sympy_service import build_sympy_locals


def _build_ode_contract(
    *,
    equation_text: str,
    ics: dict[object, object],
    indep_name: str,
) -> dict[str, object]:
    autonomy_hint = "nonautonomous" if re.search(rf"\b{re.escape(indep_name)}\b", equation_text) else "autonomous"
    derivative_order = 3 if "'''" in equation_text else 2 if "''" in equation_text else 1
    checks = [
        {
            "id": "equation",
            "label": "Equation form",
            "status": "ok" if "=" in equation_text else "warn",
            "detail": "Explicit equality detected." if "=" in equation_text else "Solver interpreted the relation as `lhs = 0`.",
        },
        {
            "id": "independent_variable",
            "label": "Independent variable",
            "status": "ok",
            "detail": f"Using `{indep_name}` as the independent axis.",
        },
        {
            "id": "initial_conditions",
            "label": "Initial / boundary data",
            "status": "ok" if ics else "info",
            "detail": f"{len(ics)} condition(s) parsed." if ics else "No explicit initial condition was parsed.",
        },
        {
            "id": "autonomy",
            "label": "Family read",
            "status": "ok",
            "detail": f"Detected an {autonomy_hint} ODE lane.",
        },
        {
            "id": "order",
            "label": "Derivative order",
            "status": "ok" if derivative_order == 1 else "info",
            "detail": f"Detected order {derivative_order}.",
        },
    ]
    severity_order = {"ok": 0, "info": 1, "warn": 2, "error": 3}
    worst = max(checks, key=lambda item: severity_order[item["status"]])["status"]
    review_notes = []
    if not ics:
        review_notes.append("No initial data was provided, so the symbolic family should be read as an equation-level result.")
    if derivative_order > 1:
        review_notes.append("Higher-order ODEs benefit from boundary completeness checks before publication use.")
    review_notes.append(f"Family hint: {autonomy_hint}.")
    return finalize_lane_contract(
        status=worst,
        checks=checks,
        completeness="complete" if ics else "equation_only",
        family_hint=f"{autonomy_hint}_ode",
        blocker_count=0,
        hazard_count=0 if ics else 1,
        review_notes=review_notes,
    )


def _split_ode_expression(expression: str) -> tuple[str, list[str]]:
    parts = [part.strip() for part in re.split(r"[;\n]+", expression) if part.strip()]
    if not parts:
        raise DifferentialSolverError("ODE lane uchun equation kiritilmadi.")
    return parts[0], parts[1:]


def _replace_ode_tokens(text: str, dep_name: str, indep_name: str) -> str:
    dep_pattern = re.escape(dep_name)
    indep_pattern = re.escape(indep_name)
    updated = text
    updated = re.sub(rf"\b{dep_pattern}'''", f"Derivative({dep_name}({indep_name}), ({indep_name}, 3))", updated)
    updated = re.sub(rf"\b{dep_pattern}''", f"Derivative({dep_name}({indep_name}), ({indep_name}, 2))", updated)
    updated = re.sub(rf"\b{dep_pattern}'", f"Derivative({dep_name}({indep_name}), {indep_name})", updated)
    updated = re.sub(rf"\b{dep_pattern}\b(?!\s*\()", f"{dep_name}({indep_name})", updated)
    return updated


def _parse_ics(clauses: list[str], dep_func: Function, indep_var: Symbol, locals_dict: dict[str, object]) -> dict[object, object]:
    ics: dict[object, object] = {}
    dep_name = dep_func.__name__
    indep_name = str(indep_var)

    for clause in clauses:
        if "=" not in clause:
            continue
        left, right = [part.strip() for part in clause.split("=", 1)]
        right_expr = sp.sympify(right, locals=locals_dict)

        m0 = re.fullmatch(rf"{dep_name}\((.+)\)", left)
        m1 = re.fullmatch(rf"{dep_name}'\((.+)\)", left)
        m2 = re.fullmatch(rf"{dep_name}''\((.+)\)", left)

        if m0:
            at_expr = sp.sympify(m0.group(1), locals=locals_dict)
            ics[dep_func(indep_var).subs(indep_var, at_expr)] = right_expr
        elif m1:
            at_expr = sp.sympify(m1.group(1), locals=locals_dict)
            ics[sp.diff(dep_func(indep_var), indep_var).subs(indep_var, at_expr)] = right_expr
        elif m2:
            at_expr = sp.sympify(m2.group(1), locals=locals_dict)
            ics[sp.diff(dep_func(indep_var), (indep_var, 2)).subs(indep_var, at_expr)] = right_expr

    return ics


def solve_ode_lane(
    expression: str,
    variable: str,
    point: str,
) -> DifferentialSolveResult:
    indep_name = variable.split(",")[0].strip() or "x"
    dep_name = "y"
    indep_var = sp.Symbol(indep_name, real=True)
    dep_func = Function(dep_name)

    equation_text, clauses = _split_ode_expression(expression)
    normalized_equation = _replace_ode_tokens(equation_text, dep_name, indep_name)

    if "=" in normalized_equation:
        lhs_text, rhs_text = [part.strip() for part in normalized_equation.split("=", 1)]
    else:
        lhs_text, rhs_text = normalized_equation, "0"

    locals_dict = build_sympy_locals([indep_name])
    locals_dict[dep_name] = dep_func
    locals_dict["Derivative"] = sp.Derivative

    try:
        lhs = sp.sympify(lhs_text, locals=locals_dict)
        rhs = sp.sympify(rhs_text, locals=locals_dict)
    except Exception as exc:
        raise DifferentialSolverError(f"ODE parse xatosi: {exc}") from exc

    equation = Eq(lhs, rhs)
    ics = _parse_ics(clauses + ([point] if point.strip() else []), dep_func, indep_var, locals_dict)

    try:
        solution = dsolve(equation, ics=ics or None)
    except Exception as exc:
        raise DifferentialSolverError(f"ODE symbolic solve muvaffaqiyatsiz: {exc}") from exc

    taxonomy = infer_symbolic_taxonomy(rhs - lhs, "ode")
    ic_note = ", ".join(f"{latex(key)} = {latex(value)}" for key, value in ics.items()) if ics else None
    contract = _build_ode_contract(equation_text=equation_text, ics=ics, indep_name=indep_name)

    return DifferentialSolveResult(
        status="exact",
        message="ODE symbolic lane result tayyor.",
        payload={
            "input": {
                "expression": expression,
                "variable": variable,
                "point": point,
                "lane": "ode",
            },
            "parser": {
                "expression_raw": expression,
                "expression_normalized": equation_text,
                "expression_latex": latex(equation),
                "variable": variable,
                "point_raw": point,
                "point_normalized": point.strip(),
                "notes": ["ODE shorthand symbolic equation ga o'girdi."],
            },
            "diagnostics": {
                "continuity": "continuous",
                "differentiability": "differentiable",
                "domain_analysis": {
                    "constraints": [],
                    "assumptions": ["ODE lane explicit y(x) relation asosida ishladi."],
                    "blockers": [],
                },
                "contract": contract,
                "taxonomy": taxonomy,
            },
            "exact": {
                "method_label": "SymPy dsolve",
                "derivative_latex": latex(solution),
                "evaluated_latex": ic_note,
                "numeric_approximation": None,
                "taxonomy_family": taxonomy["family"],
                "steps": [
                    {
                        "title": "Equation Assembly",
                        "summary": "ODE shorthand symbolic Eq ga aylantirildi.",
                        "latex": latex(equation),
                        "tone": "neutral",
                    },
                    {
                        "title": "Initial / Boundary Conditions",
                        "summary": ic_note or "Qo'shimcha shart berilmadi.",
                        "latex": ic_note,
                        "tone": "info",
                    },
                    {
                        "title": "Symbolic Solution",
                        "summary": "dsolve orqali ODE yechimi topildi.",
                        "latex": latex(solution),
                        "tone": "success",
                    },
                ],
            },
        },
    )
