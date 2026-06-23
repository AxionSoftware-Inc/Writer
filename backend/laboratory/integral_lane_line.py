from __future__ import annotations

from sympy import Integral, Matrix, Symbol, latex, simplify, sqrt
from sympy import integrate as sympy_integrate
from sympy import N as sympy_numeric

from .integral_lane_common import IntegralSolveResult, IntegralSolverError, attach_research_diagnostics, build_diagnostics_payload
from .integral_lane_geometry import parse_geometry_expression, parse_interval, parse_tuple
from .sympy_service import MathParserError, parse_user_math_input


def solve_line_integral(expression: str) -> IntegralSolveResult:
    try:
        spec = parse_geometry_expression(expression, "line")
        parameter_name = spec.fields.get("parameter", "t")
        parameter_interval = spec.fields.get(parameter_name) or spec.fields.get("t")
        if not parameter_interval:
            raise IntegralSolverError("Line lane uchun parameter interval kerak, masalan t:[0,1].")

        lower_text, upper_text = parse_interval(parameter_interval)
        path_components = parse_tuple(spec.fields["path"])
        if len(path_components) not in (2, 3):
            raise IntegralSolverError("Line lane path 2D yoki 3D tuple bo'lishi kerak.")

        lower_input = parse_user_math_input(lower_text, label="Line parameter lower")
        upper_input = parse_user_math_input(upper_text, label="Line parameter upper")
        parameter_input = parse_user_math_input(parameter_name, label="Line parameter", variable_names=(parameter_name,))
        parameter_symbol = parameter_input.expression

        path_symbols = ("x", "y") if len(path_components) == 2 else ("x", "y", "z")
        substitution_symbols = [Symbol(symbol_name, real=True) for symbol_name in path_symbols]
        path_vector = Matrix(
            [
                parse_user_math_input(component, label=f"Path component {index + 1}", variable_names=(parameter_name,)).expression
                for index, component in enumerate(path_components)
            ]
        )
        tangent = path_vector.diff(parameter_symbol)

        if "f" in spec.fields:
            scalar_field = parse_user_math_input(spec.fields["f"], label="Line scalar field", variable_names=path_symbols).expression
            substitutions = {substitution_symbols[index]: path_vector[index] for index in range(len(path_symbols))}
            integrand = simplify(scalar_field.subs(substitutions) * sqrt(simplify(tangent.dot(tangent))))
            method_label = "Scalar line integral"
            method_summary = "Scalar field parametrized curve ustida arc-length weighting bilan baholandi."
        else:
            field_keys = ("p", "q") if len(path_components) == 2 else ("p", "q", "r")
            if not all(key in spec.fields for key in field_keys):
                raise IntegralSolverError("Line lane uchun P/Q yoki P/Q/R componentlari kerak.")
            vector_field = Matrix(
                [
                    parse_user_math_input(spec.fields[key], label=f"Field {key.upper()}", variable_names=path_symbols).expression
                    for key in field_keys
                ]
            )
            substitutions = {substitution_symbols[index]: path_vector[index] for index in range(len(path_symbols))}
            integrand = simplify(vector_field.subs(substitutions).dot(tangent))
            method_label = "Vector circulation"
            method_summary = "Vector field parametrik path bo'ylab F(r(t)) · r'(t) dt ko'rinishida baholandi."

        definite_value = simplify(sympy_integrate(integrand, (parameter_symbol, lower_input.expression, upper_input.expression)))
        numeric_approximation = None if definite_value.has(Integral) else str(sympy_numeric(definite_value, 15))

        diagnostics = build_diagnostics_payload(
            expression_text=expression,
            expression=integrand,
            lower_expr=lower_input.expression,
            upper_expr=upper_input.expression,
            lower_text=lower_text,
            upper_text=upper_text,
            convergence="not_applicable",
            convergence_detail="Line integral parametrik path bo'yicha finite intervalda baholandi.",
            convergence_reason="parametric_curve",
            singularity="possible" if "/" in latex(integrand) else "none",
        )
    except MathParserError as exc:
        raise IntegralSolverError(str(exc)) from exc
    except KeyError as exc:
        raise IntegralSolverError(f"Line lane field missing: {exc.args[0]}") from exc
    except ValueError as exc:
        raise IntegralSolverError(str(exc)) from exc

    if definite_value.has(Integral):
        diagnostics = attach_research_diagnostics(diagnostics, status="needs_numerical", can_offer_numerical=False)
        return IntegralSolveResult(
            status="needs_numerical",
            message="Line integral closed-form ko'rinishga to'liq tushmadi.",
            payload={
                "input": {"expression": expression, "lane": "line_integral"},
                "parser": {"expression_raw": expression, "expression_normalized": expression, "expression_latex": latex(Integral(integrand, (parameter_symbol, lower_input.expression, upper_input.expression))), "lower_raw": lower_text, "lower_normalized": lower_text, "lower_latex": lower_input.latex, "upper_raw": upper_text, "upper_normalized": upper_text, "upper_latex": upper_input.latex, "notes": []},
                "diagnostics": diagnostics,
                "reason": "line_integral_unresolved",
                "can_offer_numerical": False,
                "exact": {
                    "method_label": method_label,
                    "method_summary": method_summary,
                    "antiderivative_latex": None,
                    "definite_integral_latex": latex(Integral(integrand, (parameter_symbol, lower_input.expression, upper_input.expression))),
                    "evaluated_latex": None,
                    "numeric_approximation": None,
                    "contains_special_functions": False,
                    "steps": [],
                },
            },
        )

    diagnostics = attach_research_diagnostics(diagnostics, status="exact", can_offer_numerical=False)
    return IntegralSolveResult(
        status="exact",
        message="Line integral parametrik lane orqali baholandi.",
        payload={
            "input": {"expression": expression, "lane": "line_integral"},
            "parser": {"expression_raw": expression, "expression_normalized": expression, "expression_latex": latex(Integral(integrand, (parameter_symbol, lower_input.expression, upper_input.expression))), "lower_raw": lower_text, "lower_normalized": lower_text, "lower_latex": lower_input.latex, "upper_raw": upper_text, "upper_normalized": upper_text, "upper_latex": upper_input.latex, "notes": []},
            "diagnostics": diagnostics,
            "can_offer_numerical": False,
            "exact": {
                "method_label": method_label,
                "method_summary": method_summary,
                "antiderivative_latex": None,
                "definite_integral_latex": latex(Integral(integrand, (parameter_symbol, lower_input.expression, upper_input.expression))),
                "evaluated_latex": latex(definite_value),
                "numeric_approximation": numeric_approximation,
                "contains_special_functions": False,
                "steps": [
                    {"title": "Path setup", "summary": "Parametrik yo'l va tangent vector qurildi.", "latex": latex(path_vector), "tone": "info"},
                    {"title": "Pulled-back integrand", "summary": "Field path bo'ylab parameterga o'tkazildi.", "latex": latex(integrand), "tone": "info"},
                    {"title": "Line result", "summary": "Finite parameter intervalda integral baholandi.", "latex": latex(definite_value), "tone": "success"},
                ],
            },
        },
    )
