from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sympy import Abs, Eq, FiniteSet, Integral, Max, Min, Piecewise, S, Symbol, denom, exp, latex, log, simplify, solveset
from sympy import sin, cos, tan, sign
from sympy.core.power import Pow

from .sympy_service import ParsedMathInput


X_SYMBOL = Symbol("x", real=True)


class IntegralSolverError(ValueError):
    pass


@dataclass
class IntegralSolveResult:
    status: str
    message: str
    payload: dict[str, Any]


def _format_condition_text(condition: Any) -> str:
    if condition is True:
        return "always"
    if condition is False:
        return "never"
    return latex(condition)


def _format_expression_text(expression: Any) -> str:
    return latex(simplify(expression))


def _is_infinite_bound(value: Any | None) -> bool:
    return bool(value is not None and getattr(value, "is_infinite", False))


def infer_domain_analysis(expression: Any) -> dict[str, Any]:
    constraints: list[dict[str, str]] = []
    assumptions: list[str] = []
    blockers: list[str] = []

    for log_atom in sorted(expression.atoms(log), key=latex):
        detail = f"{_format_expression_text(log_atom.args[0])} > 0"
        constraints.append(
            {
                "kind": "log_argument_positive",
                "label": "Log domain",
                "detail": detail,
                "severity": "blocker",
            }
        )

    for pow_atom in sorted(expression.atoms(Pow), key=latex):
        exponent = pow_atom.exp
        if getattr(exponent, "is_Rational", False) and getattr(exponent, "q", 1) % 2 == 0:
            base_text = _format_expression_text(pow_atom.base)
            constraints.append(
                {
                    "kind": "even_root_radicand",
                    "label": "Root domain",
                    "detail": f"{base_text} >= 0",
                    "severity": "blocker",
                }
            )

    denominator = simplify(denom(expression))
    if denominator != 1:
        denominator_text = _format_expression_text(denominator)
        constraints.append(
            {
                "kind": "denominator_nonzero",
                "label": "Pole avoidance",
                "detail": f"{denominator_text} != 0",
                "severity": "blocker",
            }
        )
        try:
            analysis_symbol = X_SYMBOL if len(expression.free_symbols) == 1 and X_SYMBOL in expression.free_symbols else None
            roots = solveset(Eq(denominator, 0), analysis_symbol or X_SYMBOL, domain=S.Reals) if analysis_symbol else None
            if isinstance(roots, FiniteSet) and roots:
                blockers.extend(sorted(f"x = {_format_expression_text(root)}" for root in roots))
        except Exception:
            pass

    if expression.has(Piecewise):
        assumptions.append("Explicit Piecewise structure detected.")
    if expression.has(Max) or expression.has(Min):
        assumptions.append("Comparison-based branches affect the active region.")

    return {
        "constraints": constraints,
        "assumptions": assumptions,
        "blockers": blockers,
    }


def infer_hazard_details(
    expression: Any,
    lower_expr: Any | None = None,
    upper_expr: Any | None = None,
) -> list[dict[str, str]]:
    hazards: list[dict[str, str]] = []
    denominator = simplify(denom(expression))
    lower_text = _format_expression_text(lower_expr) if lower_expr is not None else ""
    upper_text = _format_expression_text(upper_expr) if upper_expr is not None else ""

    if _is_infinite_bound(lower_expr) or _is_infinite_bound(upper_expr):
        hazards.append(
            {
                "kind": "infinite_bound",
                "label": "Infinite bound",
                "detail": "At least one integration limit is infinite; asymptotic decay controls convergence.",
                "severity": "warn",
            }
        )

    if denominator != 1:
        try:
            analysis_symbol = X_SYMBOL if len(expression.free_symbols) == 1 and X_SYMBOL in expression.free_symbols else None
            roots = solveset(Eq(denominator, 0), analysis_symbol or X_SYMBOL, domain=S.Reals) if analysis_symbol else None
            if isinstance(roots, FiniteSet):
                for root in roots:
                    root_text = _format_expression_text(root)
                    severity = "info"
                    detail = f"Potential pole at x = {root_text}."
                    if lower_text == root_text or upper_text == root_text:
                        severity = "warn"
                        detail = f"Endpoint touches pole at x = {root_text}."
                    hazards.append(
                        {
                            "kind": "pole",
                            "label": "Pole risk",
                            "detail": detail,
                            "severity": severity,
                        }
                    )
        except Exception:
            hazards.append(
                {
                    "kind": "pole",
                    "label": "Pole risk",
                    "detail": "Denominator may introduce isolated singularities inside the active interval.",
                    "severity": "warn",
                }
            )

    for log_atom in sorted(expression.atoms(log), key=latex):
        argument_text = _format_expression_text(log_atom.args[0])
        if lower_text in {"0", "0.0"}:
            hazards.append(
                {
                    "kind": "log_endpoint",
                    "label": "Log singularity",
                    "detail": f"Lower endpoint touches a logarithmic boundary for {argument_text}.",
                    "severity": "warn",
                }
            )

    return hazards


def infer_piecewise_regions(expression: Any) -> dict[str, Any]:
    regions: list[dict[str, str]] = []
    source = "none"

    for abs_atom in sorted(expression.atoms(Abs), key=latex):
        argument = simplify(abs_atom.args[0])
        source = "abs"
        regions.extend(
            [
                {
                    "kind": "sign_split",
                    "region": f"{_format_expression_text(argument)} < 0",
                    "behavior": f"|{_format_expression_text(argument)}| = -({_format_expression_text(argument)})",
                    "boundary": f"{_format_expression_text(argument)} = 0",
                },
                {
                    "kind": "sign_split",
                    "region": f"{_format_expression_text(argument)} >= 0",
                    "behavior": f"|{_format_expression_text(argument)}| = {_format_expression_text(argument)}",
                    "boundary": f"{_format_expression_text(argument)} = 0",
                },
            ]
        )

    for sign_atom in sorted(expression.atoms(sign), key=latex):
        argument = simplify(sign_atom.args[0])
        source = "sign"
        regions.extend(
            [
                {
                    "kind": "sign_split",
                    "region": f"{_format_expression_text(argument)} < 0",
                    "behavior": f"sign({_format_expression_text(argument)}) = -1",
                    "boundary": f"{_format_expression_text(argument)} = 0",
                },
                {
                    "kind": "sign_split",
                    "region": f"{_format_expression_text(argument)} = 0",
                    "behavior": f"sign({_format_expression_text(argument)}) = 0",
                    "boundary": f"{_format_expression_text(argument)} = 0",
                },
                {
                    "kind": "sign_split",
                    "region": f"{_format_expression_text(argument)} > 0",
                    "behavior": f"sign({_format_expression_text(argument)}) = 1",
                    "boundary": f"{_format_expression_text(argument)} = 0",
                },
            ]
        )

    for piecewise_atom in sorted(expression.atoms(Piecewise), key=latex):
        source = "piecewise"
        for branch_expression, condition in piecewise_atom.args:
            regions.append(
                {
                    "kind": "piecewise_branch",
                    "region": _format_condition_text(condition),
                    "behavior": _format_expression_text(branch_expression),
                    "boundary": _format_condition_text(condition),
                }
            )

    for max_atom in sorted(expression.atoms(Max), key=latex):
        source = "max"
        left, right = max_atom.args[:2]
        regions.append(
            {
                "kind": "comparison_split",
                "region": f"{_format_expression_text(left)} >= {_format_expression_text(right)}",
                "behavior": f"max = {_format_expression_text(left)}",
                "boundary": f"{_format_expression_text(left)} = {_format_expression_text(right)}",
            }
        )
        regions.append(
            {
                "kind": "comparison_split",
                "region": f"{_format_expression_text(left)} < {_format_expression_text(right)}",
                "behavior": f"max = {_format_expression_text(right)}",
                "boundary": f"{_format_expression_text(left)} = {_format_expression_text(right)}",
            }
        )

    for min_atom in sorted(expression.atoms(Min), key=latex):
        source = "min"
        left, right = min_atom.args[:2]
        regions.append(
            {
                "kind": "comparison_split",
                "region": f"{_format_expression_text(left)} <= {_format_expression_text(right)}",
                "behavior": f"min = {_format_expression_text(left)}",
                "boundary": f"{_format_expression_text(left)} = {_format_expression_text(right)}",
            }
        )
        regions.append(
            {
                "kind": "comparison_split",
                "region": f"{_format_expression_text(left)} > {_format_expression_text(right)}",
                "behavior": f"min = {_format_expression_text(right)}",
                "boundary": f"{_format_expression_text(left)} = {_format_expression_text(right)}",
            }
        )

    deduped_regions: list[dict[str, str]] = []
    seen_regions: set[tuple[str, str]] = set()
    for region in regions:
        key = (region["region"], region["behavior"])
        if key in seen_regions:
            continue
        deduped_regions.append(region)
        seen_regions.add(key)

    return {
        "active": bool(deduped_regions),
        "source": source,
        "split_count": len(deduped_regions),
        "regions": deduped_regions,
    }


def build_diagnostics_payload(
    *,
    expression_text: str,
    expression: Any,
    lower_expr: Any | None = None,
    upper_expr: Any | None = None,
    lower_text: str | None = None,
    upper_text: str | None = None,
    convergence: str = "not_applicable",
    convergence_detail: str = "",
    convergence_reason: str = "standard_finite_interval",
    singularity: str = "none",
) -> dict[str, Any]:
    domain_analysis = infer_domain_analysis(expression)
    hazard_details = infer_hazard_details(expression, lower_expr, upper_expr)
    piecewise = infer_piecewise_regions(expression)
    return {
        "convergence": convergence,
        "convergence_detail": convergence_detail,
        "convergence_reason": convergence_reason,
        "singularity": singularity,
        "domain_constraints": [item["detail"] for item in domain_analysis["constraints"]],
        "hazards": [item["detail"] for item in hazard_details],
        "domain_analysis": domain_analysis,
        "hazard_details": hazard_details,
        "piecewise": piecewise,
    }


def attach_research_diagnostics(
    diagnostics: dict[str, Any],
    *,
    status: str,
    can_offer_numerical: bool,
    contains_special_functions: bool = False,
) -> dict[str, Any]:
    blocker_count = len(diagnostics["domain_analysis"]["blockers"]) + sum(
        1 for item in diagnostics["domain_analysis"]["constraints"] if item["severity"] == "blocker"
    )
    warn_hazards = sum(1 for item in diagnostics["hazard_details"] if item["severity"] == "warn")

    if status == "exact":
        exactness_tier = "special_function_closed_form" if contains_special_functions else "symbolic_closed_form"
    elif can_offer_numerical:
        exactness_tier = "requires_numerical_confirmation"
    else:
        exactness_tier = "symbolic_unresolved"

    if blocker_count > 0 or diagnostics["convergence"] == "divergent":
        domain_risk_level = "high"
    elif warn_hazards > 0 or diagnostics["piecewise"]["active"] or diagnostics["convergence"] == "unresolved":
        domain_risk_level = "medium"
    else:
        domain_risk_level = "low"

    if status == "exact" and domain_risk_level == "low":
        readiness_label = "publication_ready"
    elif status == "exact":
        readiness_label = "research_review"
    elif can_offer_numerical:
        readiness_label = "numerical_confirmation"
    else:
        readiness_label = "manual_review"

    review_notes: list[str] = []
    if diagnostics["piecewise"]["active"]:
        review_notes.append("Piecewise branch audit active.")
    if blocker_count:
        review_notes.append(f"{blocker_count} domain blocker signal detected.")
    if warn_hazards:
        review_notes.append(f"{warn_hazards} hazard warning requires review.")
    if contains_special_functions:
        review_notes.append("Closed form uses special functions.")
    if diagnostics["convergence"] == "unresolved":
        review_notes.append("Convergence still requires manual interpretation.")
    if diagnostics["convergence"] == "divergent":
        review_notes.append("Integral diverges under symbolic limit analysis.")
    if not review_notes:
        review_notes.append("No critical symbolic audit blockers detected.")

    return {
        **diagnostics,
        "research": {
            "exactness_tier": exactness_tier,
            "domain_risk_level": domain_risk_level,
            "readiness_label": readiness_label,
            "blocker_count": blocker_count,
            "hazard_count": warn_hazards,
            "piecewise_active": diagnostics["piecewise"]["active"],
            "special_function_signal": contains_special_functions,
            "review_notes": review_notes,
        },
    }


def build_parser_payload(
    *,
    integrand_input: ParsedMathInput,
    lower_input: ParsedMathInput | None = None,
    upper_input: ParsedMathInput | None = None,
) -> dict[str, Any]:
    return {
        "expression_raw": integrand_input.raw,
        "expression_normalized": integrand_input.normalized,
        "expression_latex": integrand_input.latex,
        "lower_raw": lower_input.raw if lower_input else "",
        "lower_normalized": lower_input.normalized if lower_input else "",
        "lower_latex": lower_input.latex if lower_input else "",
        "upper_raw": upper_input.raw if upper_input else "",
        "upper_normalized": upper_input.normalized if upper_input else "",
        "upper_latex": upper_input.latex if upper_input else "",
        "notes": [
            *integrand_input.notes,
            *([f"Quyi chegara: {note}" for note in lower_input.notes] if lower_input else []),
            *([f"Yuqori chegara: {note}" for note in upper_input.notes] if upper_input else []),
        ],
    }


def describe_integration_strategy(integrand: Any) -> dict[str, str]:
    if integrand.is_polynomial(X_SYMBOL):
        return {
            "label": "Power Rule",
            "summary": "Ifoda polinomial shaklda. SymPy kuchlar qoidasi va algebraik soddalashtirish bilan primitive topdi.",
        }
    if integrand.is_rational_function(X_SYMBOL):
        return {
            "label": "Rational Reduction",
            "summary": "Ifoda ratsional tuzilishga ega. SymPy algebraik ajratish va logarifmik komponentlar orqali primitive qidirdi.",
        }
    if integrand.has(exp):
        return {
            "label": "Exponential Structure",
            "summary": "Ifoda eksponentsial komponentlarni o'z ichiga oladi. SymPy eksponentsial qoidalar va symbolic reduction ishlatdi.",
        }
    if integrand.has(sin) or integrand.has(cos) or integrand.has(tan):
        return {
            "label": "Trigonometric Structure",
            "summary": "Ifoda trigonometrik komponentlarni o'z ichiga oladi. SymPy trig identities va symbolic integration ishlatdi.",
        }
    if integrand.has(log):
        return {
            "label": "Logarithmic Structure",
            "summary": "Ifoda logarifmik komponentlarga ega. SymPy symbolic reduction va transformatsiyalar bilan primitive qidirdi.",
        }
    return {
        "label": "Symbolic Reduction",
        "summary": "SymPy ifodani umumiy symbolic reduction orqali qayta yozib, closed-form primitive qidirishga urinib ko'rdi.",
    }


def build_exact_steps(
    *,
    integrand_input: ParsedMathInput,
    lower_input: ParsedMathInput,
    upper_input: ParsedMathInput,
    antiderivative: Any,
    definite_value: Any,
    numeric_approximation: str | None,
    method_meta: dict[str, str],
) -> list[dict[str, Any]]:
    antiderivative_latex = latex(antiderivative)
    interval_integral_latex = latex(Integral(integrand_input.expression, (X_SYMBOL, lower_input.expression, upper_input.expression)))
    bounds_evaluation_latex = rf"\left[{antiderivative_latex}\right]_{{{lower_input.latex}}}^{{{upper_input.latex}}}"

    steps: list[dict[str, Any]] = [
        {
            "title": "Parser Translation",
            "summary": "Foydalanuvchi yozuvi SymPy uchun normalizatsiya qilindi va symbolic ifodaga aylantirildi.",
            "latex": rf"f(x) = {integrand_input.latex}",
            "tone": "neutral",
        },
        {
            "title": "Method Detection",
            "summary": f"{method_meta['label']}: {method_meta['summary']}",
            "latex": None,
            "tone": "info",
        },
        {
            "title": "Antiderivative",
            "summary": "Primitive topildi va keyingi bosqichda chegaralarda baholash uchun saqlandi.",
            "latex": rf"F(x) = {antiderivative_latex}",
            "tone": "info",
        },
        {
            "title": "Bounds Evaluation",
            "summary": "Definite integral fundamental theorem orqali yuqori va quyi chegaralarda baholandi.",
            "latex": rf"{interval_integral_latex} = {bounds_evaluation_latex}",
            "tone": "info",
        },
        {
            "title": "Exact Result",
            "summary": "Yakuniy symbolic natija soddalashtirildi.",
            "latex": rf"{interval_integral_latex} = {latex(definite_value)}",
            "tone": "success",
        },
    ]

    if numeric_approximation:
        steps.append(
            {
                "title": "Numeric Check",
                "summary": "Exact natijaning decimal ko'rinishi ham chiqarildi.",
                "latex": rf"{latex(definite_value)} \approx {numeric_approximation}",
                "tone": "neutral",
            }
        )

    return steps


def build_unresolved_steps(
    *,
    integrand_input: ParsedMathInput,
    lower_input: ParsedMathInput,
    upper_input: ParsedMathInput,
    antiderivative_latex: str | None,
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {
            "title": "Parser Translation",
            "summary": "Foydalanuvchi yozuvi symbolic ko'rinishga normalizatsiya qilindi.",
            "latex": rf"f(x) = {integrand_input.latex}",
            "tone": "neutral",
        },
        {
            "title": "Definite Integral Setup",
            "summary": "Chegaralar symbolic shaklda tayyorlandi, lekin closed-form baholash yakuniga yetmadi.",
            "latex": latex(Integral(integrand_input.expression, (X_SYMBOL, lower_input.expression, upper_input.expression))),
            "tone": "warn",
        },
    ]

    if antiderivative_latex:
        steps.append(
            {
                "title": "Partial Symbolic Result",
                "summary": "Primitive topilgan bo'lishi mumkin, lekin definite integral closed-form ko'rinishga to'liq tushmadi.",
                "latex": rf"F(x) = {antiderivative_latex}",
                "tone": "info",
            }
        )

    steps.append(
        {
            "title": "Numerical Confirmation Needed",
            "summary": "Shu sabab numerik hisoblashni foydalanuvchi alohida tasdiqlashi kerak.",
            "latex": None,
            "tone": "warn",
        }
    )
    return steps


def build_indefinite_steps(
    *,
    integrand_input: ParsedMathInput,
    antiderivative: Any,
    method_meta: dict[str, str],
) -> list[dict[str, Any]]:
    antiderivative_latex = latex(antiderivative)
    return [
        {
            "title": "Parser Translation",
            "summary": "Foydalanuvchi yozuvi SymPy uchun normalizatsiya qilindi va symbolic ifodaga aylantirildi.",
            "latex": rf"f(x) = {integrand_input.latex}",
            "tone": "neutral",
        },
        {
            "title": "Method Detection",
            "summary": f"{method_meta['label']}: {method_meta['summary']}",
            "latex": None,
            "tone": "info",
        },
        {
            "title": "Antiderivative",
            "summary": "Aniqmas integral uchun primitive topildi.",
            "latex": rf"\int {integrand_input.latex}\,dx = {antiderivative_latex} + C",
            "tone": "success",
        },
    ]
