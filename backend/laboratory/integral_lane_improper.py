from __future__ import annotations

from sympy import Integral, latex, simplify
from sympy import integrate as sympy_integrate
from sympy import N as sympy_numeric

from .integral_lane_common import (
    X_SYMBOL,
    IntegralSolveResult,
    IntegralSolverError,
    build_diagnostics_payload,
    attach_research_diagnostics,
    build_exact_steps,
    build_parser_payload,
    build_unresolved_steps,
    describe_integration_strategy,
)
from .sympy_service import MathParserError, parse_user_math_input


def solve_improper_single_integral(expression: str, lower: str, upper: str) -> IntegralSolveResult:
    try:
        integrand_input = parse_user_math_input(expression, label="Ifoda", variable_names=("x",))
        lower_input = parse_user_math_input(lower, label="Quyi chegara")
        upper_input = parse_user_math_input(upper, label="Yuqori chegara")
    except MathParserError as exc:
        raise IntegralSolverError(str(exc)) from exc

    integrand = integrand_input.expression
    lower_bound = lower_input.expression
    upper_bound = upper_input.expression
    antiderivative = simplify(sympy_integrate(integrand, X_SYMBOL))
    definite_value = simplify(sympy_integrate(integrand, (X_SYMBOL, lower_bound, upper_bound)))
    method_meta = describe_integration_strategy(integrand)
    parser_payload = build_parser_payload(integrand_input=integrand_input, lower_input=lower_input, upper_input=upper_input)
    base_payload = {
        "input": {
            "expression": expression,
            "lower": lower,
            "upper": upper,
            "expression_latex": integrand_input.latex,
            "lower_latex": lower_input.latex,
            "upper_latex": upper_input.latex,
            "lane": "improper_single",
        },
        "parser": parser_payload,
        "diagnostics": build_diagnostics_payload(
            expression_text=expression,
            expression=integrand,
            lower_expr=lower_bound,
            upper_expr=upper_bound,
            lower_text=lower,
            upper_text=upper,
            convergence="unresolved",
            convergence_detail="Improper integral requires limit and singularity diagnostics.",
            convergence_reason="improper_limit_analysis",
            singularity="endpoint" if lower.strip() == "0" or upper.strip() == "0" else "possible",
        ),
    }

    if definite_value.has(Integral):
        diagnostics = attach_research_diagnostics(
            {
                **base_payload["diagnostics"],
                "convergence": "unresolved",
                "convergence_detail": "SymPy could not close the improper limit analytically.",
                "convergence_reason": "symbolic_limit_unresolved",
            },
            status="needs_numerical",
            can_offer_numerical=False,
        )
        return IntegralSolveResult(
            status="needs_numerical",
            message="Improper integral closed-form ko'rinishda hal bo'lmadi.",
            payload={
                **base_payload,
                "diagnostics": diagnostics,
                "reason": "sympy_could_not_resolve_improper_integral",
                "can_offer_numerical": False,
                "exact": {
                    "method_label": method_meta["label"],
                    "method_summary": method_meta["summary"],
                    "antiderivative_latex": None if antiderivative.has(Integral) else latex(antiderivative),
                    "definite_integral_latex": latex(Integral(integrand, (X_SYMBOL, lower_bound, upper_bound))),
                    "evaluated_latex": None,
                    "numeric_approximation": None,
                    "contains_special_functions": False,
                    "steps": build_unresolved_steps(
                        integrand_input=integrand_input,
                        lower_input=lower_input,
                        upper_input=upper_input,
                        antiderivative_latex=None if antiderivative.has(Integral) else latex(antiderivative),
                    ),
                },
            },
        )

    if getattr(definite_value, "is_infinite", False):
        diagnostics = attach_research_diagnostics(
            {
                **base_payload["diagnostics"],
                "convergence": "divergent",
                "convergence_detail": "Improper limit evaluation produced a non-finite result.",
                "convergence_reason": "non_finite_limit",
            },
            status="needs_numerical",
            can_offer_numerical=False,
        )
        return IntegralSolveResult(
            status="needs_numerical",
            message="Improper integral divergent yoki non-finite bo'lib chiqdi.",
            payload={
                **base_payload,
                "diagnostics": diagnostics,
                "reason": "improper_integral_diverges",
                "can_offer_numerical": False,
                "exact": {
                    "method_label": method_meta["label"],
                    "method_summary": "Cheksiz chegarali yoki singular integral non-finite natija berdi.",
                    "antiderivative_latex": None if antiderivative.has(Integral) else latex(antiderivative),
                    "definite_integral_latex": latex(Integral(integrand, (X_SYMBOL, lower_bound, upper_bound))),
                    "evaluated_latex": latex(definite_value),
                    "numeric_approximation": None,
                    "contains_special_functions": False,
                    "steps": [
                        {
                            "title": "Improper Setup",
                            "summary": "Integral improper shaklda baholandi.",
                            "latex": latex(Integral(integrand, (X_SYMBOL, lower_bound, upper_bound))),
                            "tone": "warn",
                        },
                        {
                            "title": "Divergence Signal",
                            "summary": "Natija non-finite bo'lib chiqdi. Convergence analysis kerak.",
                            "latex": latex(definite_value),
                            "tone": "warn",
                        },
                    ],
                },
            },
        )

    numeric_approximation = None
    try:
        numeric_approximation = str(sympy_numeric(definite_value, 15))
    except Exception:
        numeric_approximation = None

    contains_special_functions = any(
        token in latex(definite_value) for token in ("operatorname{erf}", "operatorname{Si}", "operatorname{Ci}", "Fresnel", "Gamma", "log")
    )
    diagnostics = attach_research_diagnostics(
        {
            **base_payload["diagnostics"],
            "convergence": "convergent",
            "convergence_detail": "Symbolic limit evaluation resolved to a finite value.",
            "convergence_reason": "finite_symbolic_limit",
        },
        status="exact",
        can_offer_numerical=False,
        contains_special_functions=contains_special_functions,
    )

    return IntegralSolveResult(
        status="exact",
        message="Improper integral symbolic limit bilan baholandi.",
        payload={
            **base_payload,
            "diagnostics": diagnostics,
            "can_offer_numerical": False,
            "exact": {
                "method_label": method_meta["label"],
                "method_summary": "Improper integral symbolic limit evaluation orqali baholandi.",
                "antiderivative_latex": None if antiderivative.has(Integral) else latex(antiderivative),
                "definite_integral_latex": latex(Integral(integrand, (X_SYMBOL, lower_bound, upper_bound))),
                "evaluated_latex": latex(definite_value),
                "numeric_approximation": numeric_approximation,
                "contains_special_functions": contains_special_functions,
                "steps": build_exact_steps(
                    integrand_input=integrand_input,
                    lower_input=lower_input,
                    upper_input=upper_input,
                    antiderivative=antiderivative,
                    definite_value=definite_value,
                    numeric_approximation=numeric_approximation,
                    method_meta=method_meta,
                ),
            },
        },
    )
