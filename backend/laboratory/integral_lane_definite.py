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
from .method_registry import get_integral_method
from .sympy_service import MathParserError, parse_user_math_input


def _build_reproducibility_payload(
    *,
    expression: str,
    lower: str,
    upper: str,
    method_meta: dict[str, str],
    selected_method_meta: dict[str, str],
    status: str,
    numeric_strategy: str,
    selected_method: str,
    method_family: str,
) -> dict[str, object]:
    adapter_status = selected_method_meta.get("adapter_status", "active")
    numeric_comment = "# Selected method: {label} ({family}, adapter: {status}).\n".format(
        label=selected_method_meta["label"],
        family=method_family,
        status=adapter_status,
    )
    if adapter_status != "active":
        numeric_comment += "# This backend response records the method intent; the dedicated compute adapter is not active yet.\n"
    code = f'''import sympy as sp

x = sp.symbols("x", real=True)
expr = sp.sympify({expression!r})
lower = sp.sympify({lower!r})
upper = sp.sympify({upper!r})

# Analytic path used by MathSphere Integral Studio.
antiderivative = sp.simplify(sp.integrate(expr, x))
definite_value = sp.simplify(sp.integrate(expr, (x, lower, upper)))

{numeric_comment.rstrip()}
# Decimal check: this is not an independent quadrature.
# It evaluates the symbolic result numerically when SymPy produced one.
numeric_approximation = sp.N(definite_value, 15)

print("Antiderivative:", antiderivative)
print("Exact definite value:", definite_value)
print("Numeric approximation:", numeric_approximation)
'''
    return {
        "language": "python",
        "libraries": ["sympy"],
        "engine": "sympy",
        "method": selected_method_meta["label"],
        "method_summary": method_meta["summary"],
        "status": status,
        "numeric_strategy": numeric_strategy,
        "selected_method": selected_method,
        "method_family": method_family,
        "adapter_status": adapter_status,
        "editable": True,
        "code": code,
        "notes": [
            "Analytic result is produced with sympy.integrate.",
            "numeric_approximation uses sympy.N on the symbolic definite value.",
            f"Selected method adapter status: {adapter_status}.",
            "If the integral is unresolved, this snippet shows the same unresolved state unless you add a numerical quadrature method manually.",
        ],
    }


def solve_definite_single_integral(expression: str, lower: str, upper: str, method: str = "auto") -> IntegralSolveResult:
    selected_method, selected_method_meta = get_integral_method(method)
    try:
        integrand_input = parse_user_math_input(expression, label="Ifoda", variable_names=("x",))
        lower_input = parse_user_math_input(lower, label="Quyi chegara", require_numeric=True)
        upper_input = parse_user_math_input(upper, label="Yuqori chegara", require_numeric=True)
    except MathParserError as exc:
        raise IntegralSolverError(str(exc)) from exc

    integrand = integrand_input.expression
    lower_bound = lower_input.expression
    upper_bound = upper_input.expression

    if (upper_bound - lower_bound).is_real is False:
        raise IntegralSolverError("Chegaralar haqiqiy son bo'lishi kerak.")

    try:
        if float(sympy_numeric(upper_bound - lower_bound, 20)) <= 0:
            raise IntegralSolverError("Yuqori chegara quyi chegaradan katta bo'lishi kerak.")
    except TypeError as exc:
        raise IntegralSolverError("Chegaralarni son sifatida baholab bo'lmadi.") from exc

    antiderivative = simplify(sympy_integrate(integrand, X_SYMBOL))
    definite_value = simplify(sympy_integrate(integrand, (X_SYMBOL, lower_bound, upper_bound)))

    unresolved_antiderivative = antiderivative.has(Integral)
    unresolved_definite = definite_value.has(Integral)
    parser_payload = build_parser_payload(integrand_input=integrand_input, lower_input=lower_input, upper_input=upper_input)
    base_payload = {
        "input": {
            "expression": expression,
            "lower": lower,
            "upper": upper,
            "expression_latex": integrand_input.latex,
            "lower_latex": lower_input.latex,
            "upper_latex": upper_input.latex,
            "lane": "definite_single",
        },
        "parser": parser_payload,
        "diagnostics": build_diagnostics_payload(
            expression_text=expression,
            expression=integrand,
            lower_expr=lower_bound,
            upper_expr=upper_bound,
            lower_text=lower,
            upper_text=upper,
            convergence="not_applicable",
            convergence_detail="Finite definite integral lane uses standard domain checks.",
            convergence_reason="finite_interval",
            singularity="possible" if "/" in expression.replace(" ", "") else "none",
        ),
    }

    if unresolved_definite:
        method_meta = describe_integration_strategy(integrand)
        diagnostics = attach_research_diagnostics(
            base_payload["diagnostics"],
            status="needs_numerical",
            can_offer_numerical=True,
        )
        return IntegralSolveResult(
            status="needs_numerical",
            message="Analitik closed-form yechim topilmadi. Numerik hisoblashni alohida tasdiqlash kerak.",
            payload={
                **base_payload,
                "diagnostics": diagnostics,
                "reason": "sympy_could_not_resolve_definite_integral",
                "can_offer_numerical": True,
                "reproducibility": _build_reproducibility_payload(
                    expression=expression,
                    lower=lower,
                    upper=upper,
                    method_meta=method_meta,
                    selected_method_meta=selected_method_meta,
                    status="needs_numerical",
                    numeric_strategy="not_computed_unresolved_symbolic_integral",
                    selected_method=selected_method,
                    method_family=selected_method_meta["family"],
                ),
                "exact": {
                    "method_label": method_meta["label"],
                    "method_summary": method_meta["summary"],
                    "antiderivative_latex": None if unresolved_antiderivative else latex(antiderivative),
                    "definite_integral_latex": latex(Integral(integrand, (X_SYMBOL, lower_bound, upper_bound))),
                    "evaluated_latex": None,
                    "numeric_approximation": None,
                    "contains_special_functions": False,
                    "steps": build_unresolved_steps(
                        integrand_input=integrand_input,
                        lower_input=lower_input,
                        upper_input=upper_input,
                        antiderivative_latex=None if unresolved_antiderivative else latex(antiderivative),
                    ),
                },
            },
        )

    numeric_approximation = None
    try:
        numeric_approximation = str(sympy_numeric(definite_value, 15))
    except Exception:
        numeric_approximation = None

    contains_special_functions = any(
        token in latex(definite_value)
        for token in ("operatorname{erf}", "operatorname{Si}", "operatorname{Ci}", "Fresnel", "Gamma", "log")
    )
    method_meta = describe_integration_strategy(integrand)
    diagnostics = attach_research_diagnostics(
        base_payload["diagnostics"],
        status="exact",
        can_offer_numerical=True,
        contains_special_functions=contains_special_functions,
    )

    return IntegralSolveResult(
        status="exact",
        message="Analitik yechim topildi.",
        payload={
            **base_payload,
            "diagnostics": diagnostics,
            "can_offer_numerical": True,
            "reproducibility": _build_reproducibility_payload(
                expression=expression,
                lower=lower,
                upper=upper,
                method_meta=method_meta,
                selected_method_meta=selected_method_meta,
                status="exact",
                numeric_strategy=selected_method_meta["numeric_strategy"],
                selected_method=selected_method,
                method_family=selected_method_meta["family"],
            ),
            "exact": {
                "method_label": method_meta["label"],
                "method_summary": method_meta["summary"],
                "antiderivative_latex": None if unresolved_antiderivative else latex(antiderivative),
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
