from __future__ import annotations

from sympy import Integral, latex, simplify
from sympy import integrate as sympy_integrate

from .integral_lane_common import (
    X_SYMBOL,
    IntegralSolveResult,
    IntegralSolverError,
    build_diagnostics_payload,
    attach_research_diagnostics,
    build_indefinite_steps,
    build_parser_payload,
    describe_integration_strategy,
)
from .sympy_service import MathParserError, parse_user_math_input


def solve_indefinite_single_integral(expression: str) -> IntegralSolveResult:
    try:
        integrand_input = parse_user_math_input(expression, label="Ifoda", variable_names=("x",))
    except MathParserError as exc:
        raise IntegralSolverError(str(exc)) from exc

    integrand = integrand_input.expression
    antiderivative = simplify(sympy_integrate(integrand, X_SYMBOL))
    method_meta = describe_integration_strategy(integrand)
    parser_payload = build_parser_payload(integrand_input=integrand_input)
    base_payload = {
        "input": {
            "expression": expression,
            "lower": "",
            "upper": "",
            "expression_latex": integrand_input.latex,
            "lower_latex": "",
            "upper_latex": "",
            "lane": "indefinite_single",
        },
        "parser": parser_payload,
        "diagnostics": build_diagnostics_payload(
            expression_text=expression,
            expression=integrand,
            convergence="not_applicable",
            convergence_detail="Indefinite symbolic lane does not run numerical convergence checks.",
            convergence_reason="indefinite_symbolic_lane",
            singularity="possible" if "/" in expression.replace(" ", "") else "none",
        ),
    }

    if antiderivative.has(Integral):
        diagnostics = attach_research_diagnostics(
            base_payload["diagnostics"],
            status="needs_numerical",
            can_offer_numerical=False,
        )
        return IntegralSolveResult(
            status="needs_numerical",
            message="Aniqmas integral uchun closed-form primitive topilmadi.",
            payload={
                **base_payload,
                "diagnostics": diagnostics,
                "reason": "sympy_could_not_resolve_indefinite_integral",
                "can_offer_numerical": False,
                "exact": {
                    "method_label": method_meta["label"],
                    "method_summary": method_meta["summary"],
                    "antiderivative_latex": None,
                    "definite_integral_latex": None,
                    "evaluated_latex": None,
                    "numeric_approximation": None,
                    "contains_special_functions": False,
                    "steps": [
                        {
                            "title": "Parser Translation",
                            "summary": "Foydalanuvchi yozuvi symbolic ko'rinishga normalizatsiya qilindi.",
                            "latex": rf"f(x) = {integrand_input.latex}",
                            "tone": "neutral",
                        },
                        {
                            "title": "Symbolic Attempt",
                            "summary": "SymPy primitive qidirdi, lekin closed-form topilmadi.",
                            "latex": latex(Integral(integrand, X_SYMBOL)),
                            "tone": "warn",
                        },
                    ],
                },
            },
        )

    antiderivative_latex = latex(antiderivative)
    contains_special_functions = any(
        token in antiderivative_latex for token in ("operatorname{erf}", "operatorname{Si}", "operatorname{Ci}", "Fresnel", "Gamma", "log")
    )
    diagnostics = attach_research_diagnostics(
        base_payload["diagnostics"],
        status="exact",
        can_offer_numerical=False,
        contains_special_functions=contains_special_functions,
    )
    return IntegralSolveResult(
        status="exact",
        message="Aniqmas integral uchun primitive topildi.",
        payload={
            **base_payload,
            "diagnostics": diagnostics,
            "can_offer_numerical": False,
            "exact": {
                "method_label": method_meta["label"],
                "method_summary": method_meta["summary"],
                "antiderivative_latex": antiderivative_latex,
                "definite_integral_latex": None,
                "evaluated_latex": rf"{antiderivative_latex} + C",
                "numeric_approximation": None,
                "contains_special_functions": contains_special_functions,
                "steps": build_indefinite_steps(
                    integrand_input=integrand_input,
                    antiderivative=antiderivative,
                    method_meta=method_meta,
                ),
            },
        },
    )
