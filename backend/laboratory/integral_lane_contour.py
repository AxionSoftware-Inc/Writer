from __future__ import annotations

from sympy import I, Integral, Symbol, Wild, diff, exp, latex, pi, residue, simplify
from sympy.calculus.singularities import singularities
from sympy import integrate as sympy_integrate
from sympy import N as sympy_numeric

from .integral_lane_common import IntegralSolveResult, IntegralSolverError, attach_research_diagnostics, build_diagnostics_payload
from .integral_lane_geometry import parse_geometry_expression, parse_interval
from .sympy_service import MathParserError, parse_user_math_input


def _complex_to_dict(value) -> dict[str, float] | None:
    try:
        numeric = complex(sympy_numeric(value, 12))
    except Exception:
        return None
    if not (numeric.real == numeric.real and numeric.imag == numeric.imag):
        return None
    return {"real": float(numeric.real), "imag": float(numeric.imag)}


def _sample_complex_path(path_expression, parameter_symbol, lower_expr, upper_expr, sample_count: int = 96) -> list[dict[str, float]]:
    samples: list[dict[str, float]] = []
    lower_value = float(sympy_numeric(lower_expr, 12))
    upper_value = float(sympy_numeric(upper_expr, 12))
    for index in range(max(8, sample_count)):
        ratio = index / max(1, sample_count - 1)
        parameter_value = lower_value + (upper_value - lower_value) * ratio
        point = simplify(path_expression.subs({parameter_symbol: parameter_value}))
        point_dict = _complex_to_dict(point)
        if point_dict is None:
            continue
        samples.append({"x": point_dict["real"], "y": point_dict["imag"]})
    return samples


def _build_residue_analysis(integrand_expression, path_expression, parameter_symbol, lower_expr, upper_expr, definite_value):
    z_symbol = next(iter(integrand_expression.free_symbols), Symbol("z", real=True))
    closed_positive = simplify(lower_expr) == 0 and simplify(upper_expr - 2 * pi) == 0
    closed_negative = simplify(lower_expr) == 0 and simplify(upper_expr + 2 * pi) == 0

    center = None
    radius = None
    orientation = "unknown"
    center_wild = Wild("center", exclude=[parameter_symbol])
    radius_wild = Wild("radius", exclude=[parameter_symbol])
    positive_match = path_expression.match(center_wild + radius_wild * exp(I * parameter_symbol))
    negative_match = path_expression.match(center_wild + radius_wild * exp(-I * parameter_symbol))

    if positive_match:
        center = simplify(positive_match.get(center_wild, 0))
        radius = simplify(positive_match.get(radius_wild, 1))
        orientation = "counterclockwise"
    elif negative_match:
        center = simplify(negative_match.get(center_wild, 0))
        radius = simplify(negative_match.get(radius_wild, 1))
        orientation = "clockwise"
    elif closed_positive:
        center = 0
        radius = 1
        orientation = "counterclockwise"
    elif closed_negative:
        center = 0
        radius = 1
        orientation = "clockwise"

    if center is None or radius is None:
        return None

    center_complex = _complex_to_dict(center)
    radius_numeric = abs(complex(sympy_numeric(radius, 12))) if center_complex is not None else None
    if center_complex is None or radius_numeric is None:
        return None

    try:
        singular_set = singularities(integrand_expression, z_symbol)
        singular_points = list(singular_set) if hasattr(singular_set, "__iter__") else []
    except Exception:
        singular_points = []

    enclosed_poles = []
    for pole in singular_points:
        pole_complex = _complex_to_dict(pole)
        if pole_complex is None:
            continue
        distance = abs(complex(pole_complex["real"] - center_complex["real"], pole_complex["imag"] - center_complex["imag"]))
        if distance > radius_numeric + 1e-9:
            continue
        try:
            residue_value = simplify(residue(integrand_expression, z_symbol, pole))
        except Exception:
            residue_value = None
        enclosed_poles.append({
            "pole_latex": latex(pole),
            "pole": pole_complex,
            "residue_latex": latex(residue_value) if residue_value is not None else "unresolved",
        })

    if not enclosed_poles:
        return None

    resolved_residues = []
    for pole in singular_points:
        pole_complex = _complex_to_dict(pole)
        if pole_complex is None:
            continue
        distance = abs(complex(pole_complex["real"] - center_complex["real"], pole_complex["imag"] - center_complex["imag"]))
        if distance > radius_numeric + 1e-9:
            continue
        try:
            resolved_residues.append(simplify(residue(integrand_expression, z_symbol, pole)))
        except Exception:
            continue
    if not resolved_residues:
        return None
    theorem_value = simplify(2 * pi * I * sum(resolved_residues))
    if orientation == "clockwise":
        theorem_value = simplify(-theorem_value)

    return {
        "orientation": orientation,
        "center_latex": latex(center),
        "radius_latex": latex(radius),
        "enclosed_poles": enclosed_poles,
        "theorem_value_latex": latex(theorem_value),
        "direct_value_match": simplify(theorem_value - definite_value) == 0,
        "path_samples": _sample_complex_path(path_expression, parameter_symbol, lower_expr, upper_expr),
    }


def solve_contour_integral(expression: str) -> IntegralSolveResult:
    try:
        spec = parse_geometry_expression(expression, "contour")
        parameter_name = spec.fields.get("parameter", "t")
        parameter_interval = spec.fields.get(parameter_name) or spec.fields.get("t")
        if not parameter_interval:
            raise IntegralSolverError("Contour lane uchun t:[a,b] intervali kerak.")

        lower_text, upper_text = parse_interval(parameter_interval)
        path_expression = parse_user_math_input(spec.fields["path"], label="Contour path", variable_names=(parameter_name,)).expression
        integrand_expression = parse_user_math_input(spec.fields["f"], label="Contour integrand", variable_names=("z",)).expression
        parameter_symbol = parse_user_math_input(parameter_name, label="Contour parameter", variable_names=(parameter_name,)).expression
        lower_input = parse_user_math_input(lower_text, label="Contour lower")
        upper_input = parse_user_math_input(upper_text, label="Contour upper")

        pulled_integrand = simplify(integrand_expression.subs({Symbol("z", real=True): path_expression}) * diff(path_expression, parameter_symbol))
        definite_value = simplify(sympy_integrate(pulled_integrand, (parameter_symbol, lower_input.expression, upper_input.expression)))
        numeric_approximation = None if definite_value.has(Integral) else str(sympy_numeric(definite_value, 15))
        residue_analysis = _build_residue_analysis(
            integrand_expression,
            path_expression,
            parameter_symbol,
            lower_input.expression,
            upper_input.expression,
            definite_value,
        )
        diagnostics = build_diagnostics_payload(
            expression_text=expression,
            expression=pulled_integrand,
            lower_expr=lower_input.expression,
            upper_expr=upper_input.expression,
            lower_text=lower_text,
            upper_text=upper_text,
            convergence="not_applicable",
            convergence_detail="Contour lane parametrik complex path bo'yicha finite interval ishlatadi.",
            convergence_reason="complex_parametric_path",
            singularity="possible" if "/" in latex(pulled_integrand) else "none",
        )
    except MathParserError as exc:
        raise IntegralSolverError(str(exc)) from exc
    except KeyError as exc:
        raise IntegralSolverError(f"Contour lane field missing: {exc.args[0]}") from exc
    except ValueError as exc:
        raise IntegralSolverError(str(exc)) from exc

    if definite_value.has(Integral):
        diagnostics = attach_research_diagnostics(diagnostics, status="needs_numerical", can_offer_numerical=False)
        return IntegralSolveResult(
            status="needs_numerical",
            message="Contour integral closed-form ko'rinishga to'liq tushmadi.",
            payload={
                "input": {"expression": expression, "lane": "contour_integral"},
                "parser": {"expression_raw": expression, "expression_normalized": expression, "expression_latex": latex(Integral(pulled_integrand, (parameter_symbol, lower_input.expression, upper_input.expression))), "lower_raw": lower_text, "lower_normalized": lower_text, "lower_latex": lower_input.latex, "upper_raw": upper_text, "upper_normalized": upper_text, "upper_latex": upper_input.latex, "notes": []},
                "diagnostics": diagnostics,
                "reason": "contour_integral_unresolved",
                "can_offer_numerical": False,
                "exact": {"method_label": "Contour pullback", "method_summary": "Complex contour parametrga tortildi, lekin symbolic integral yakunlanmadi.", "antiderivative_latex": None, "definite_integral_latex": latex(Integral(pulled_integrand, (parameter_symbol, lower_input.expression, upper_input.expression))), "evaluated_latex": None, "numeric_approximation": None, "contains_special_functions": False, "residue_analysis": residue_analysis, "steps": []},
            },
        )

    diagnostics = attach_research_diagnostics(diagnostics, status="exact", can_offer_numerical=False)
    return IntegralSolveResult(
        status="exact",
        message="Contour integral parametrik complex lane orqali baholandi.",
        payload={
            "input": {"expression": expression, "lane": "contour_integral"},
            "parser": {"expression_raw": expression, "expression_normalized": expression, "expression_latex": latex(Integral(pulled_integrand, (parameter_symbol, lower_input.expression, upper_input.expression))), "lower_raw": lower_text, "lower_normalized": lower_text, "lower_latex": lower_input.latex, "upper_raw": upper_text, "upper_normalized": upper_text, "upper_latex": upper_input.latex, "notes": []},
            "diagnostics": diagnostics,
            "can_offer_numerical": False,
            "exact": {
                "method_label": "Contour pullback",
                "method_summary": "Complex contour z(t) va dz/dt orqali bitta parameter integralga o'tkazildi.",
                "antiderivative_latex": None,
                "definite_integral_latex": latex(Integral(pulled_integrand, (parameter_symbol, lower_input.expression, upper_input.expression))),
                "evaluated_latex": latex(definite_value),
                "numeric_approximation": numeric_approximation,
                "contains_special_functions": False,
                "residue_analysis": residue_analysis,
                "steps": [
                    {"title": "Contour path", "summary": "Complex path parametrizatsiya qilindi.", "latex": latex(path_expression), "tone": "info"},
                    {"title": "Pullback", "summary": "f(z) dz ifodasi parameter integralga o'tkazildi.", "latex": latex(pulled_integrand), "tone": "info"},
                    *(
                        [
                            {
                                "title": "Residue audit",
                                "summary": f"{len(residue_analysis['enclosed_poles'])} enclosed poles detected; contour theorem cross-check built.",
                                "latex": residue_analysis["theorem_value_latex"],
                                "tone": "success" if residue_analysis["direct_value_match"] else "warn",
                            }
                        ]
                        if residue_analysis
                        else []
                    ),
                    {"title": "Contour result", "summary": "Contour integral baholandi.", "latex": latex(definite_value), "tone": "success"},
                ],
            },
        },
    )
