from __future__ import annotations

import re

import sympy as sp
from sympy import Eq, Function, latex, pdsolve

from .differential_lane_common import DifferentialSolveResult, DifferentialSolverError, finalize_lane_contract, infer_symbolic_taxonomy
from .sympy_service import build_sympy_locals


def _infer_pde_family(equation_text: str) -> str:
    lowered = equation_text.replace(" ", "").lower()
    if "u_t" in lowered and "u_xx" in lowered:
        return "heat_like"
    if "u_t" in lowered and "u_x" in lowered:
        return "transport_like"
    if "u_tt" in lowered:
        return "wave_like"
    return "general_pde"


def _build_pde_contract(
    *,
    equation_text: str,
    clauses: list[str],
    variables: list[str],
) -> dict[str, object]:
    has_time = any(name.strip() == "t" for name in variables)
    has_initial = any("u(" in clause.lower() and ",0" in clause.replace(" ", "") for clause in clauses)
    checks = [
        {
            "id": "equation",
            "label": "Equation form",
            "status": "ok" if "=" in equation_text else "warn",
            "detail": "Explicit PDE equality detected." if "=" in equation_text else "Solver interpreted the relation as `lhs = 0`.",
        },
        {
            "id": "variables",
            "label": "Independent variables",
            "status": "ok" if len(variables) >= 2 else "info",
            "detail": ", ".join(variables) if variables else "No variables supplied.",
        },
        {
            "id": "initial_profile",
            "label": "Initial profile",
            "status": "ok" if has_initial else "info",
            "detail": "Detected a profile like `u(x,0)=...`." if has_initial else "No explicit initial profile found.",
        },
        {
            "id": "time_axis",
            "label": "Time axis",
            "status": "ok" if has_time else "info",
            "detail": "Variable list includes `t`." if has_time else "Variable list does not explicitly include `t`.",
        },
    ]
    severity_order = {"ok": 0, "info": 1, "warn": 2, "error": 3}
    worst = max(checks, key=lambda item: severity_order[item["status"]])["status"]
    family_hint = _infer_pde_family(equation_text)
    hazard_count = 0 if has_initial else 1
    if family_hint == "general_pde":
        hazard_count += 1
    review_notes = [
        f"Family hint: {family_hint}.",
        "Symbolic PDE coverage is strongest for transport-like and heat-like families.",
    ]
    if not has_initial:
        review_notes.append("No initial profile was supplied, so downstream numerical validation is recommended.")
    return finalize_lane_contract(
        status=worst if family_hint != "general_pde" else "warn",
        checks=checks,
        completeness="profiled" if has_initial else "equation_only",
        family_hint=family_hint,
        blocker_count=0,
        hazard_count=hazard_count,
        review_notes=review_notes,
    )


def _replace_pde_tokens(text: str, dep_name: str, indep_names: list[str]) -> str:
    updated = text
    func_call = f"{dep_name}({', '.join(indep_names)})"
    derivative_specs = [
        ("_xx", f"Derivative({func_call}, ({indep_names[0]}, 2))"),
        ("_yy", f"Derivative({func_call}, ({indep_names[1]}, 2))" if len(indep_names) > 1 else f"Derivative({func_call}, ({indep_names[0]}, 2))"),
        ("_tt", f"Derivative({func_call}, ({indep_names[-1]}, 2))"),
        ("_x", f"Derivative({func_call}, {indep_names[0]})"),
        ("_y", f"Derivative({func_call}, {indep_names[1]})" if len(indep_names) > 1 else f"Derivative({func_call}, {indep_names[0]})"),
        ("_t", f"Derivative({func_call}, {indep_names[-1]})"),
    ]
    for token, replacement in derivative_specs:
        updated = re.sub(rf"\b{re.escape(dep_name + token)}\b", replacement, updated)
    updated = re.sub(rf"\b{re.escape(dep_name)}\b(?!\s*\()", func_call, updated)
    return updated


def solve_pde_lane(
    expression: str,
    variable: str,
    point: str,
) -> DifferentialSolveResult:
    indep_names = [name.strip() for name in variable.split(",") if name.strip()] or ["x", "t"]
    dep_name = "u"

    parts = [part.strip() for part in re.split(r"[;\n]+", expression) if part.strip()]
    if not parts:
        raise DifferentialSolverError("PDE lane uchun equation kiritilmadi.")
    equation_text = parts[0]
    clauses = parts[1:]
    normalized_equation = _replace_pde_tokens(equation_text, dep_name, indep_names)

    if "=" in normalized_equation:
        lhs_text, rhs_text = [part.strip() for part in normalized_equation.split("=", 1)]
    else:
        lhs_text, rhs_text = normalized_equation, "0"

    locals_dict = build_sympy_locals(indep_names)
    dep_func = Function(dep_name)
    locals_dict[dep_name] = dep_func
    locals_dict["Derivative"] = sp.Derivative

    try:
        lhs = sp.sympify(lhs_text, locals=locals_dict)
        rhs = sp.sympify(rhs_text, locals=locals_dict)
    except Exception as exc:
        raise DifferentialSolverError(f"PDE parse xatosi: {exc}") from exc

    equation = Eq(lhs, rhs)
    try:
        solution = pdsolve(equation)
    except Exception as exc:
        raise DifferentialSolverError(f"PDE symbolic solve muvaffaqiyatsiz: {exc}") from exc

    taxonomy = infer_symbolic_taxonomy(rhs - lhs, "pde")
    contract = _build_pde_contract(equation_text=equation_text, clauses=clauses, variables=indep_names)

    return DifferentialSolveResult(
        status="exact",
        message="PDE symbolic lane result tayyor.",
        payload={
            "input": {
                "expression": expression,
                "variable": variable,
                "point": point,
                "lane": "pde",
            },
            "parser": {
                "expression_raw": expression,
                "expression_normalized": equation_text,
                "expression_latex": latex(equation),
                "variable": variable,
                "point_raw": point,
                "point_normalized": point.strip(),
                "notes": ["PDE shorthand symbolic Eq ga o'girdi."],
            },
            "diagnostics": {
                "continuity": "continuous",
                "differentiability": "differentiable",
                "domain_analysis": {
                    "constraints": [],
                    "assumptions": ["PDE lane limited pdsolve oilalarini qo'llaydi."],
                    "blockers": [],
                },
                "contract": contract,
                "taxonomy": taxonomy,
            },
            "exact": {
                "method_label": "SymPy pdsolve",
                "derivative_latex": latex(solution),
                "evaluated_latex": None,
                "numeric_approximation": None,
                "taxonomy_family": taxonomy["family"],
                "steps": [
                    {
                        "title": "Equation Assembly",
                        "summary": "PDE shorthand symbolic Eq ga aylantirildi.",
                        "latex": latex(equation),
                        "tone": "neutral",
                    },
                    {
                        "title": "Symbolic PDE Solve",
                        "summary": "pdsolve qo'llab-quvvatlagan oilada yechim topildi.",
                        "latex": latex(solution),
                        "tone": "success",
                    },
                ],
            },
        },
    )
