from __future__ import annotations

from sympy import Integral, Matrix, Symbol, latex, simplify
from sympy import integrate as sympy_integrate
from sympy import N as sympy_numeric

from .integral_lane_common import IntegralSolveResult, IntegralSolverError, attach_research_diagnostics, build_diagnostics_payload
from .integral_lane_geometry import parse_geometry_expression, parse_interval, parse_tuple
from .sympy_service import MathParserError, parse_user_math_input


def solve_surface_integral(expression: str) -> IntegralSolveResult:
    try:
        spec = parse_geometry_expression(expression, "surface")
        patch_components = parse_tuple(spec.fields["patch"], expected_length=3)
        u_interval = parse_interval(spec.fields["u"])
        v_interval = parse_interval(spec.fields["v"])

        u_symbol = parse_user_math_input("u", label="Surface parameter u", variable_names=("u",)).expression
        v_symbol = parse_user_math_input("v", label="Surface parameter v", variable_names=("v",)).expression
        u_lower = parse_user_math_input(u_interval[0], label="Surface u lower").expression
        u_upper = parse_user_math_input(u_interval[1], label="Surface u upper").expression
        v_lower = parse_user_math_input(v_interval[0], label="Surface v lower").expression
        v_upper = parse_user_math_input(v_interval[1], label="Surface v upper").expression

        patch = Matrix(
            [
                parse_user_math_input(component, label=f"Patch component {index + 1}", variable_names=("u", "v")).expression
                for index, component in enumerate(patch_components)
            ]
        )
        normal = simplify(patch.diff(u_symbol).cross(patch.diff(v_symbol)))
        if spec.fields.get("orientation", "positive").lower() == "negative":
            normal = simplify(-normal)
        substitutions = {
            Symbol("x", real=True): patch[0],
            Symbol("y", real=True): patch[1],
            Symbol("z", real=True): patch[2],
        }

        if "f" in spec.fields and not spec.fields["f"].strip().startswith("("):
            scalar_field = parse_user_math_input(spec.fields["f"], label="Surface scalar field", variable_names=("x", "y", "z")).expression
            integrand = simplify(scalar_field.subs(substitutions) * simplify(normal.norm()))
            method_label = "Scalar surface integral"
            method_summary = "Scalar field surface area elementi bilan parametrik surface ustida baholandi."
        else:
            field_components = parse_tuple(spec.fields["f"], expected_length=3) if "f" in spec.fields and spec.fields["f"].startswith("(") else None
            if "fx" in spec.fields and "fy" in spec.fields and "fz" in spec.fields:
                vector_field = Matrix(
                    [
                        parse_user_math_input(spec.fields["fx"], label="Surface field Fx", variable_names=("x", "y", "z")).expression,
                        parse_user_math_input(spec.fields["fy"], label="Surface field Fy", variable_names=("x", "y", "z")).expression,
                        parse_user_math_input(spec.fields["fz"], label="Surface field Fz", variable_names=("x", "y", "z")).expression,
                    ]
                )
            elif field_components:
                vector_field = Matrix(
                    [
                        parse_user_math_input(component, label=f"Surface field {index + 1}", variable_names=("x", "y", "z")).expression
                        for index, component in enumerate(field_components)
                    ]
                )
            else:
                raise IntegralSolverError("Surface lane uchun f=(Fx,Fy,Fz) yoki fx/fy/fz fieldlari kerak.")

            integrand = simplify(vector_field.subs(substitutions).dot(normal))
            method_label = "Surface flux"
            method_summary = "Vector field parametrik surface normal orqali flux ko'rinishida baholandi."

        definite_value = simplify(sympy_integrate(sympy_integrate(integrand, (u_symbol, u_lower, u_upper)), (v_symbol, v_lower, v_upper)))
        numeric_approximation = None if definite_value.has(Integral) else str(sympy_numeric(definite_value, 15))
        diagnostics = build_diagnostics_payload(
            expression_text=expression,
            expression=integrand,
            convergence="not_applicable",
            convergence_detail="Surface lane parametrik patch bo'yicha finite domain ishlatadi.",
            convergence_reason="parametric_surface_patch",
            singularity="possible" if "/" in latex(integrand) else "none",
        )
    except MathParserError as exc:
        raise IntegralSolverError(str(exc)) from exc
    except KeyError as exc:
        raise IntegralSolverError(f"Surface lane field missing: {exc.args[0]}") from exc
    except ValueError as exc:
        raise IntegralSolverError(str(exc)) from exc

    if definite_value.has(Integral):
        diagnostics = attach_research_diagnostics(diagnostics, status="needs_numerical", can_offer_numerical=False)
        return IntegralSolveResult(
            status="needs_numerical",
            message="Surface integral closed-form ko'rinishga to'liq tushmadi.",
            payload={
                "input": {"expression": expression, "lane": "surface_integral"},
                "parser": {"expression_raw": expression, "expression_normalized": expression, "expression_latex": latex(definite_value), "lower_raw": "", "lower_normalized": "", "lower_latex": "", "upper_raw": "", "upper_normalized": "", "upper_latex": "", "notes": []},
                "diagnostics": diagnostics,
                "reason": "surface_integral_unresolved",
                "can_offer_numerical": False,
                "exact": {"method_label": method_label, "method_summary": method_summary, "antiderivative_latex": None, "definite_integral_latex": latex(integrand), "evaluated_latex": None, "numeric_approximation": None, "contains_special_functions": False, "steps": []},
            },
        )

    diagnostics = attach_research_diagnostics(diagnostics, status="exact", can_offer_numerical=False)
    return IntegralSolveResult(
        status="exact",
        message="Surface integral parametrik lane orqali baholandi.",
        payload={
            "input": {"expression": expression, "lane": "surface_integral"},
            "parser": {"expression_raw": expression, "expression_normalized": expression, "expression_latex": latex(integrand), "lower_raw": "", "lower_normalized": "", "lower_latex": "", "upper_raw": "", "upper_normalized": "", "upper_latex": "", "notes": []},
            "diagnostics": diagnostics,
            "can_offer_numerical": False,
            "exact": {
                "method_label": method_label,
                "method_summary": method_summary,
                "antiderivative_latex": None,
                "definite_integral_latex": latex(integrand),
                "evaluated_latex": latex(definite_value),
                "numeric_approximation": numeric_approximation,
                "contains_special_functions": False,
                "steps": [
                    {"title": "Surface patch", "summary": "Parametrik patch va oriented normal qurildi.", "latex": latex(patch), "tone": "info"},
                    {"title": "Flux integrand", "summary": "Field surface parametrlariga tortildi.", "latex": latex(integrand), "tone": "info"},
                    {"title": "Surface result", "summary": "Patch domain bo'yicha integral baholandi.", "latex": latex(definite_value), "tone": "success"},
                ],
            },
        },
    )
