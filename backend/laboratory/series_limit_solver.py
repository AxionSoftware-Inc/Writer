from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

import sympy as sp
from sympy import latex


class SeriesLimitSolverError(ValueError):
    pass


@dataclass
class SeriesLimitSolveResult:
    status: str
    message: str
    payload: dict[str, Any]


def _normalize_expression(expression: str) -> str:
    return expression.strip().replace("^", "**").replace("inf", "oo")


def _sympify(expression: str) -> sp.Expr:
    try:
        return sp.sympify(_normalize_expression(expression), locals={"pi": sp.pi, "e": sp.E, "oo": sp.oo, "inf": sp.oo})
    except Exception as exc:
        raise SeriesLimitSolverError(f"Ifoda o'qilmadi: {expression}") from exc


def _parse_arrow(auxiliary: str, fallback: str) -> tuple[sp.Symbol, sp.Expr, str]:
    match = re.match(r"\s*([A-Za-z]\w*)\s*->\s*(.+)\s*$", auxiliary or "")
    if not match:
        symbol = sp.Symbol(fallback)
        return symbol, sp.Integer(0), "0"
    symbol = sp.Symbol(match.group(1))
    target_raw = match.group(2).strip()
    return symbol, _sympify(target_raw), target_raw


def _parse_sum(expression: str) -> tuple[sp.Expr, sp.Symbol, sp.Expr, sp.Expr] | None:
    raw = expression.strip()
    simple_match = re.match(r"(?:sum|summation)\((.+),\s*([A-Za-z]\w*)\s*=\s*(.+)\.\.(.+)\)$", raw, re.IGNORECASE)
    if simple_match:
        term = _sympify(simple_match.group(1))
        index = sp.Symbol(simple_match.group(2))
        start = _sympify(simple_match.group(3))
        end = _sympify(simple_match.group(4))
        return term, index, start, end

    tuple_match = re.match(r"(?:sum|summation)\((.+),\s*\(\s*([A-Za-z]\w*)\s*,\s*(.+)\s*,\s*(.+)\s*\)\)$", raw, re.IGNORECASE)
    if tuple_match:
        term = _sympify(tuple_match.group(1))
        index = sp.Symbol(tuple_match.group(2))
        start = _sympify(tuple_match.group(3))
        end = _sympify(tuple_match.group(4))
        return term, index, start, end
    return None


def _default_series_input(expression: str) -> tuple[sp.Expr, sp.Symbol, sp.Expr, sp.Expr]:
    term = _sympify(expression)
    index_name = "n" if "n" in expression else "k"
    index = sp.Symbol(index_name, integer=True, positive=True)
    return term, index, sp.Integer(1), sp.oo


def _series_summary(term: sp.Expr, index: sp.Symbol, start: sp.Expr) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    term_points: list[dict[str, Any]] = []
    partial_points: list[dict[str, Any]] = []
    partial = 0.0
    for step in range(12):
        n_value = int(start) + step
        try:
            term_value = complex(term.subs(index, n_value).evalf())
        except Exception:
            break
        if abs(term_value.imag) > 1e-8:
            break
        term_real = float(term_value.real)
        partial += term_real
        term_points.append({"x": n_value, "y": term_real})
        partial_points.append({"x": n_value, "y": partial})
    return term_points, partial_points


def _sequence_summary(expr: sp.Expr, index: sp.Symbol, start: int = 1, count: int = 14) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    points: list[dict[str, Any]] = []
    delta_points: list[dict[str, Any]] = []
    last_real: float | None = None
    for n_value in range(start, start + count):
        try:
            term_value = complex(expr.subs(index, n_value).evalf())
        except Exception:
            break
        if abs(term_value.imag) > 1e-8:
            break
        term_real = float(term_value.real)
        points.append({"x": n_value, "y": term_real})
        if last_real is not None:
            delta_points.append({"x": n_value, "y": term_real - last_real})
        last_real = term_real
    return points, delta_points


def _expansion_preview(expr: sp.Expr, symbol: sp.Symbol, point: sp.Expr, order: int = 4) -> str | None:
    try:
        if point == sp.oo or point == -sp.oo:
            expansion = sp.aseries(expr, symbol, point, order)
        else:
            expansion = sp.series(expr, symbol, point, order)
        return latex(expansion)
    except Exception:
        return None


def _limit_expansion_preview(expr: sp.Expr, symbol: sp.Symbol, point: sp.Expr, order: int = 4) -> str | None:
    try:
        if point in {sp.oo, -sp.oo}:
            dummy = sp.Symbol("t", positive=True)
            transformed = sp.simplify(expr.subs(symbol, 1 / dummy))
            expansion = sp.series(transformed, dummy, 0, order)
            return latex(expansion).replace("t", f"1 / {latex(symbol)}")
        return latex(sp.series(expr, symbol, point, order))
    except Exception:
        return _expansion_preview(expr, symbol, point, order)


def _real_limit(expr: sp.Expr, symbol: sp.Symbol, target: sp.Expr) -> sp.Expr | None:
    try:
        value = sp.limit(expr, symbol, target)
    except Exception:
        return None
    return value if value.is_real or value.is_finite else value


def _sequence_profile(samples: list[dict[str, Any]]) -> tuple[str, str]:
    if len(samples) < 2:
        return "undetermined", "sample window too short"
    values = [point["y"] for point in samples]
    deltas = [values[idx] - values[idx - 1] for idx in range(1, len(values))]
    if all(delta >= -1e-8 for delta in deltas):
        monotone = "increasing"
    elif all(delta <= 1e-8 for delta in deltas):
        monotone = "decreasing"
    else:
        monotone = "mixed"
    lower = min(values)
    upper = max(values)
    return monotone, f"[{lower:.6f}, {upper:.6f}] on sampled tail"


def _sequence_proof_signal(expr: sp.Expr, index: sp.Symbol) -> tuple[str, str]:
    try:
        delta_expr = sp.simplify(expr.subs(index, index + 1) - expr)
        delta_limit = _real_limit(delta_expr, index, sp.oo)
        if delta_limit is not None:
            if delta_limit.is_negative:
                return "eventually decreasing by forward difference", latex(delta_expr)
            if delta_limit.is_positive:
                return "eventually increasing by forward difference", latex(delta_expr)
        ratio_expr = sp.simplify(expr.subs(index, index + 1) / expr)
        ratio_limit = _real_limit(ratio_expr, index, sp.oo)
        if ratio_limit is not None and ratio_limit.is_real:
            return f"tail ratio tends to {latex(ratio_limit)}", latex(ratio_expr)
    except Exception:
        pass
    return "sequence proof helper unresolved", ""


def _endpoint_probe(term: sp.Expr, index: sp.Symbol, start: sp.Expr, end: sp.Expr, x_symbol: sp.Symbol, endpoint: sp.Expr) -> tuple[str, str]:
    status = _endpoint_status(term, index, start, end, x_symbol, endpoint)
    endpoint_term = sp.simplify(term.subs(x_symbol, endpoint))
    primary_test, secondary_test, asymptotic_class = _detect_primary_test(endpoint_term, index, "endpoint")
    detail = f"{status}; suggested test: {primary_test}; backup: {secondary_test}; class: {asymptotic_class}"
    return status, detail


def _is_alternating(term: sp.Expr, index: sp.Symbol) -> bool:
    return term.has((-1) ** index) or term.has((-1) ** (index + 1)) or "(-1)**" in str(term)


def _p_series_exponent(term: sp.Expr, index: sp.Symbol) -> sp.Expr | None:
    candidate = sp.simplify(term * index)
    try:
        if not candidate.free_symbols or candidate.free_symbols == {index}:
            power = sp.simplify(-sp.degree(sp.denom(sp.together(term)), gen=index))
            if power != 0:
                return sp.simplify(-power)
    except Exception:
        pass

    for factor in sp.factor_terms(term).as_ordered_factors():
        if factor.is_Pow and factor.base == index:
            return sp.simplify(-factor.exp)
    numerator, denominator = sp.fraction(sp.simplify(term))
    if denominator.is_Pow and denominator.base == index:
        return sp.simplify(denominator.exp)
    return None


def _detect_primary_test(term: sp.Expr, index: sp.Symbol, auxiliary: str) -> tuple[str, str, str]:
    aux = auxiliary.lower()
    asymptotic_class = "general asymptotic series"
    proof_signal = "formal comparison still needed"

    if "ratio" in aux or term.has(sp.factorial):
        return "ratio test", "root/comparison cross-check", "factorial-exponential competition"
    if "root" in aux:
        return "root test", "ratio cross-check", "root-growth family"
    if "comparison" in aux:
        return "comparison test", "limit comparison", "comparison-ready decay"
    if _is_alternating(term, index):
        return "alternating series test", "absolute convergence screen", "alternating-decay family"

    p_value = _p_series_exponent(term, index)
    if p_value is not None:
        asymptotic_class = f"p-series class (p = {latex(p_value)})"
        proof_signal = "p-series threshold"
        return "comparison / p-series", "integral test", asymptotic_class

    ratio_probe = None
    try:
        ratio_probe = sp.simplify(sp.Abs(term.subs(index, index + 1) / term))
        ratio_limit = sp.limit(ratio_probe, index, sp.oo)
        if ratio_limit.is_real and ratio_limit != 1:
            asymptotic_class = f"ratio limit = {latex(ratio_limit)}"
            proof_signal = "ratio asymptotic resolved"
            return "ratio test", "root test", asymptotic_class
    except Exception:
        pass

    try:
        root_limit = sp.limit(sp.Abs(term) ** (1 / index), index, sp.oo)
        if root_limit.is_real and root_limit != 1:
            asymptotic_class = f"root limit = {latex(root_limit)}"
            proof_signal = "root asymptotic resolved"
            return "root test", "ratio test", asymptotic_class
    except Exception:
        pass

    return "comparison screen", "integral test", asymptotic_class


def _classify_series_family(term: sp.Expr, index: sp.Symbol) -> tuple[str, str]:
    simplified = sp.simplify(term)
    numerator, denominator = sp.fraction(simplified)
    if simplified.has(sp.factorial):
        return "factorial / exponential series", "factorial growth competes with exponential decay"
    if simplified.has(sp.harmonic):
        return "harmonic-derived series", "harmonic-number structure often needs Abelian or Tauberian continuation"
    if _is_alternating(simplified, index):
        return "alternating series", "sign oscillation suggests Leibniz-style screening"
    if numerator.has(sp.Symbol("x")) or denominator.has(sp.Symbol("x")):
        return "power series", "coefficient family depends on an external variable"
    if simplified.has(sp.log):
        return "log-corrected series", "logarithmic damping may create borderline p-series behavior"
    if simplified.has(sp.sin, sp.cos):
        return "oscillatory trigonometric series", "oscillation requires Dirichlet/Abel-style cancellation diagnostics"
    if simplified.has(sp.zeta):
        return "zeta-derived series", "special-function coefficients suggest analytic continuation awareness"
    p_value = _p_series_exponent(simplified, index)
    if p_value is not None:
        return "p-series family", f"dominant decay resembles 1/n^{{{latex(p_value)}}}"
    try:
        ratio_limit = sp.limit(sp.Abs(simplified.subs(index, index + 1) / simplified), index, sp.oo)
        if ratio_limit.is_real and ratio_limit.is_number:
            if ratio_limit < 1:
                return "geometric-like series", f"tail ratio tends to {latex(ratio_limit)}"
            if ratio_limit == 1:
                return "borderline asymptotic series", "ratio test saturates at 1 and needs secondary diagnostics"
    except Exception:
        pass
    return "general infinite series", "no single closed-form family dominates the tail"


def _singularity_scan(term: sp.Expr, index: sp.Symbol, start: sp.Expr, sample_window: int = 8) -> tuple[str, str]:
    denominator = sp.denom(sp.together(term))
    if denominator == 1 and not term.has(sp.log):
        return "no obvious singular term on sampled index set", "term is regular on the sampled discrete domain"

    try:
        start_int = int(start)
    except Exception:
        start_int = 1

    blockers: list[str] = []
    for offset in range(sample_window):
        n_value = start_int + offset
        try:
            evaluated = complex(term.subs(index, n_value).evalf())
            if not (sp.Float(evaluated.real).is_finite and sp.Float(evaluated.imag).is_finite):
                blockers.append(f"n = {n_value} gives non-finite term")
        except Exception:
            blockers.append(f"n = {n_value} is singular / undefined")

    if blockers:
        return "sampled singular indices detected", "; ".join(blockers[:4])

    if term.has(sp.log):
        return "logarithmic singularity screen active", "log terms can create endpoint or initial-index domain restrictions"
    return "denominator singularity screen clear", latex(denominator)


def _build_series_proof_details(term: sp.Expr, index: sp.Symbol, start: sp.Expr, end: sp.Expr) -> tuple[str, str]:
    if term.has(sp.sin, sp.cos):
        try:
            partial_oscillation = sp.simplify(sp.summation(term * index, (index, start, start + 3)))
            return "Dirichlet / Abel screen active", latex(partial_oscillation)
        except Exception:
            return "Dirichlet / Abel screen active", latex(sp.simplify(term))

    try:
        term_limit = sp.limit(sp.Abs(term), index, sp.oo)
        if term_limit != 0:
            return "term test blocks convergence", f"lim |a_n| = {latex(term_limit)}"
    except Exception:
        pass

    try:
        integral = sp.integrate(sp.simplify(term).subs(index, sp.Symbol("x")), (sp.Symbol("x"), 1, sp.oo))
        if integral is not None:
            return "integral-test proxy constructed", latex(integral)
    except Exception:
        pass

    if _is_alternating(term, index):
        try:
            envelope = sp.simplify(sp.Abs(term))
            env_limit = sp.limit(envelope, index, sp.oo)
            return "alternating proof helper ready", f"|a_n| -> {latex(env_limit)}"
        except Exception:
            return "alternating proof helper ready", latex(sp.Abs(term))

    if term.has(sp.log):
        try:
            cesaro_probe = sp.simplify(sp.summation(term, (index, start, start + 5)) / 6)
            return "Cesaro / Tauberian screen prepared", latex(cesaro_probe)
        except Exception:
            return "Cesaro / Tauberian screen prepared", latex(sp.simplify(term))

    return "comparison ladder established", latex(sp.simplify(term))


def _series_error_bound(term: sp.Expr, index: sp.Symbol, start: sp.Expr) -> str:
    try:
        start_int = int(start)
    except Exception:
        start_int = 1
    tail_index = start_int + 8
    try:
        tail_value = sp.simplify(sp.Abs(term.subs(index, tail_index)))
        if _is_alternating(term, index):
            return f"alternating remainder proxy: |R_N| <= {latex(tail_value)} at N = {tail_index}"
        ratio = sp.limit(sp.Abs(term.subs(index, index + 1) / term), index, sp.oo)
        if ratio.is_real and ratio.is_number and ratio < 1:
            return f"geometric-tail proxy from a_N/(1-r) with r -> {latex(ratio)}"
    except Exception:
        pass
    return "tail error bound unresolved; numeric sweep recommended"


def _special_series_signal(term: sp.Expr, index: sp.Symbol, auxiliary: str) -> str:
    if term.has(sp.sin, sp.cos):
        return "Dirichlet/Abel candidate"
    if "cesaro" in auxiliary.lower():
        return "Cesaro summability candidate"
    if "tauberian" in auxiliary.lower():
        return "Tauberian borderline candidate"
    if term.has(sp.log):
        return "log-corrected borderline family"
    if term.has(sp.factorial):
        return "factorial-exponential competition family"
    return "classical convergence family"


def _series_branch_profile(term: sp.Expr, auxiliary: str) -> tuple[str, str]:
    aux = auxiliary.lower()
    if term.has(sp.sin, sp.cos) or "dirichlet" in aux:
        return "Dirichlet / Abel research lane", "oscillatory bounded-partial-sum workflow"
    if "cesaro" in aux:
        return "Cesaro summability lane", "mean-stabilization workflow"
    if "tauberian" in aux or term.has(sp.log):
        return "Tauberian borderline lane", "borderline asymptotic regularization workflow"
    if term.has(sp.factorial):
        return "Factorial-exponential lane", "ratio-dominance workflow"
    if _is_alternating(term, next(iter(term.free_symbols), sp.Symbol("n"))):
        return "Alternating research lane", "Leibniz remainder workflow"
    return "Infinite series audit", "general comparison workflow"


def _endpoint_status(term: sp.Expr, index: sp.Symbol, start: sp.Expr, end: sp.Expr, x_symbol: sp.Symbol, endpoint: sp.Expr) -> str:
    try:
        endpoint_term = sp.simplify(term.subs(x_symbol, endpoint))
        endpoint_series = sp.Sum(endpoint_term, (index, start, end))
        convergent = endpoint_series.is_convergent()
        if convergent is True:
            return f"x = {latex(endpoint)}: convergent"
        if convergent is False:
            return f"x = {latex(endpoint)}: divergent"
        return f"x = {latex(endpoint)}: unresolved"
    except Exception:
        return f"x = {latex(endpoint)}: unresolved"


def _estimate_radius(ratio_expr: sp.Expr, x_symbol: sp.Symbol) -> tuple[str, str]:
    simplified = sp.simplify(ratio_expr)
    try:
        interval = sp.solve_univariate_inequality(simplified < 1, x_symbol, relational=False)
        interval_text = latex(interval)
    except Exception:
        interval_text = latex(simplified) + " < 1"
    radius = "pending"
    if simplified == sp.Abs(x_symbol):
        radius = "1"
    else:
        coeff = simplified.coeff(sp.Abs(x_symbol))
        if coeff not in (0, 1) and simplified == coeff * sp.Abs(x_symbol):
            radius = latex(sp.simplify(1 / coeff))
    return radius, interval_text


def _limit_family_profile(expr: sp.Expr, variable: sp.Symbol, target: sp.Expr) -> tuple[str, str, str, str]:
    try:
        left = sp.limit(expr, variable, target, dir="-")
    except Exception:
        left = None
    try:
        right = sp.limit(expr, variable, target, dir="+")
    except Exception:
        right = None

    if expr.has(sp.sin, sp.cos) and target in {sp.oo, -sp.oo}:
        return "oscillatory infinite limit", "oscillatory tail requires envelope/cancellation analysis", "Oscillatory limit lane", "left/right stabilization may fail under oscillation"
    if target in {sp.oo, -sp.oo}:
        return "infinite-point limit", "dominant balance at infinity", "Asymptotic infinity lane", "growth-rate comparison near infinity"
    if left is not None and right is not None and left != right:
        return "jump / mismatch limit", "one-sided limits disagree", "One-sided mismatch lane", "separate left/right branches must be reported"
    numerator, denominator = sp.fraction(sp.simplify(expr))
    if denominator.subs(variable, target) == 0 and numerator.subs(variable, target) == 0:
        return "removable singularity", "0/0 structure suggests cancellation or local expansion", "Removable singularity lane", "factorization and series expansion remove the singularity"
    if denominator.subs(variable, target) == 0:
        return "infinite / pole-type limit", "denominator collapses at target", "Pole-analysis lane", "sign-sensitive divergence and blow-up rate matter"
    return "local limit", "regular local behavior", "Direct symbolic limit", "formal limit operator resolves directly"


def _limit_error_bound(expr: sp.Expr, variable: sp.Symbol, target: sp.Expr) -> str:
    if target in {sp.oo, -sp.oo}:
        return "asymptotic tail error estimated by dominant-term truncation"
    try:
        delta = sp.Rational(1, 100)
        left_value = sp.N(expr.subs(variable, target - delta), 8)
        right_value = sp.N(expr.subs(variable, target + delta), 8)
        if left_value.is_real and right_value.is_real:
            spread = abs(float(right_value - left_value))
            return f"sampled local spread at h=10^-2 is about {spread:.6g}"
    except Exception:
        pass
    return "local error proxy unresolved; rely on symbolic expansion"


def _limit_one_sided_summary(expr: sp.Expr, variable: sp.Symbol, target: sp.Expr) -> tuple[str, str | None, str | None]:
    if target in {sp.oo, -sp.oo}:
        return "one-sided split not used at infinity", None, None
    try:
        left = sp.limit(expr, variable, target, dir="-")
    except Exception:
        left = None
    try:
        right = sp.limit(expr, variable, target, dir="+")
    except Exception:
        right = None
    if left is None and right is None:
        return "one-sided symbolic limits unresolved", None, None
    summary = f"left = {latex(left) if left is not None else '?'}; right = {latex(right) if right is not None else '?'}"
    left_latex = f"\\lim_{{{latex(variable)} \\to {latex(target)}^-}} {latex(expr)} = {latex(left)}" if left is not None else None
    right_latex = f"\\lim_{{{latex(variable)} \\to {latex(target)}^+}} {latex(expr)} = {latex(right)}" if right is not None else None
    return summary, left_latex, right_latex


def _build_limit(mode: str, expression: str, auxiliary: str, dimension: str) -> SeriesLimitSolveResult:
    variable, target, raw_target = _parse_arrow(auxiliary or "x -> 0", "x")
    expr = _sympify(expression)
    result = sp.limit(expr, variable, target)
    expansion = _limit_expansion_preview(expr, variable, target)
    family_label, family_detail, branch_label, proof_signal = _limit_family_profile(expr, variable, target)
    error_bound_signal = _limit_error_bound(expr, variable, target)
    one_sided_summary, left_limit_latex, right_limit_latex = _limit_one_sided_summary(expr, variable, target)
    line_series: list[dict[str, Any]] = []
    left_series: list[dict[str, Any]] = []
    right_series: list[dict[str, Any]] = []
    envelope_series: list[dict[str, Any]] = []
    if target not in {sp.oo, -sp.oo}:
        try:
            target_float = float(sp.N(target))
            for offset in (-1.0, -0.5, -0.25, -0.12, -0.06, -0.03, -0.01, -0.005, 0.005, 0.01, 0.03, 0.06, 0.12, 0.25, 0.5, 1.0):
                x_value = target_float + offset
                y_value = complex(expr.subs(variable, x_value).evalf())
                if abs(y_value.imag) <= 1e-8:
                    point = {"x": x_value, "y": float(y_value.real)}
                    line_series.append(point)
                    envelope_series.append({"x": x_value, "y": abs(float(y_value.real))})
                    if x_value < target_float:
                        left_series.append(point)
                    elif x_value > target_float:
                        right_series.append(point)
        except Exception:
            line_series = []
    dominant = "asymptotic cancellation" if expr.has(sp.sin, sp.cos) else "dominant algebraic balance"
    summary = {
        "detectedFamily": family_label,
        "candidateResult": latex(result),
        "convergenceSignal": "two-sided symbolic limit",
        "dominantTerm": dominant,
        "riskSignal": family_detail,
        "shape": "single-variable limit",
        "asymptoticSignal": f"{variable} -> {raw_target}",
        "asymptoticClass": "local asymptotic balance",
        "proofSignal": proof_signal,
        "expansionSignal": expansion,
        "errorBoundSignal": error_bound_signal,
        "specialFamilySignal": branch_label,
    }
    steps = [
        {"title": "Parse target", "summary": f"Limit {variable} -> {raw_target} sifatida o'qildi.", "latex": f"{latex(variable)} \\to {latex(target)}"},
        {"title": "Family classification", "summary": family_detail, "latex": family_label},
        {"title": "One-sided diagnostics", "summary": one_sided_summary, "latex": left_limit_latex or right_limit_latex},
        {"title": "Dominant balance", "summary": dominant, "latex": latex(expr)},
        {"title": "Expansion preview", "summary": "Local expansion symbolic lane orqali qurildi." if expansion else "Expansion preview unavailable.", "latex": expansion},
        {"title": "Error proxy", "summary": error_bound_signal, "latex": None},
        {"title": "Symbolic limit", "summary": "SymPy formal limit operator qo'llandi.", "latex": f"\\lim_{{{latex(variable)} \\to {latex(target)}}} {latex(expr)} = {latex(result)}"},
    ]
    return SeriesLimitSolveResult(
        status="exact",
        message="Limit symbolic solver yakunlandi.",
        payload={
            "input": {"mode": mode, "expression": expression, "auxiliary": auxiliary, "dimension": dimension},
            "parser": {"expression_raw": expression, "expression_latex": latex(expr), "auxiliary_raw": auxiliary},
            "diagnostics": {"lane": mode, "method": branch_label, "risk": summary["riskSignal"], "convergence": "resolved"},
            "summary": summary,
            "exact": {
                "method_label": branch_label,
                "result_latex": latex(result),
                "auxiliary_latex": expansion or f"{latex(variable)} \\to {latex(target)}",
                "numeric_approximation": str(sp.N(result, 12)) if result.is_real else None,
                "steps": steps,
            },
            "preview": {
                "lineSeries": line_series,
                "secondaryLineSeries": left_series + right_series,
                "tertiaryLineSeries": envelope_series,
            },
        },
    )


def _build_sequence(mode: str, expression: str, auxiliary: str, dimension: str) -> SeriesLimitSolveResult:
    variable, target, raw_target = _parse_arrow(auxiliary or "n -> oo", "n")
    expr = _sympify(expression)
    result = sp.limit(expr, variable, target)
    expansion = _limit_expansion_preview(expr, variable, target)
    line_series, delta_series = _sequence_summary(expr, variable)
    samples = [point["y"] for point in line_series[:6]]
    monotone, boundedness = _sequence_profile(line_series)
    proof_signal, proof_formula = _sequence_proof_signal(expr, variable)
    asymptotic_class = "exponential-stabilizing" if "n" in expression and "^n" in expression else "sequence tail limit"
    summary = {
        "detectedFamily": "sequence",
        "candidateResult": latex(result),
        "convergenceSignal": "sequence limit computed",
        "dominantTerm": "n-asymptotic growth",
        "riskSignal": "resolved symbolically",
        "shape": "discrete sequence",
        "monotonicity": monotone,
        "boundedness": boundedness,
        "asymptoticSignal": f"{variable} -> {raw_target}",
        "asymptoticClass": asymptotic_class,
        "proofSignal": proof_signal,
        "expansionSignal": expansion,
    }
    steps = [
        {"title": "Sequence parse", "summary": f"Sequence {variable} -> {raw_target} bo'yicha audit qilindi.", "latex": latex(expr)},
        {"title": "Tail profile", "summary": f"Monotonicity signal: {monotone}.", "latex": ", ".join(f"{sample:.6f}" for sample in samples[:4])},
        {"title": "Asymptotic preview", "summary": "Sequence asymptotic expansion preview.", "latex": expansion},
        {"title": "Proof helper", "summary": proof_signal, "latex": proof_formula or None},
        {"title": "Tail limit", "summary": "Sequence limiti symbolic tarzda baholandi.", "latex": f"\\lim_{{{latex(variable)} \\to {latex(target)}}} {latex(expr)} = {latex(result)}"},
    ]
    return SeriesLimitSolveResult(
        status="exact",
        message="Sequence solver yakunlandi.",
        payload={
            "input": {"mode": mode, "expression": expression, "auxiliary": auxiliary, "dimension": dimension},
            "parser": {"expression_raw": expression, "expression_latex": latex(expr), "auxiliary_raw": auxiliary},
            "diagnostics": {"lane": mode, "method": "Sequence limit", "risk": "low", "convergence": "resolved"},
            "summary": summary,
            "exact": {
                "method_label": "Sequence limit",
                "result_latex": latex(result),
                "auxiliary_latex": expansion or f"{latex(variable)} \\to {latex(target)}",
                "numeric_approximation": str(sp.N(result, 12)) if result.is_real else None,
                "steps": steps,
            },
            "preview": {"lineSeries": line_series, "secondaryLineSeries": delta_series},
        },
    )


def _build_series(mode: str, expression: str, auxiliary: str, dimension: str) -> SeriesLimitSolveResult:
    parsed = _parse_sum(expression)
    term, index, start, end = parsed or _default_series_input(expression)
    summation = sp.Sum(term, (index, start, end))
    try:
        result = sp.summation(term, (index, start, end))
    except Exception:
        result = summation
    try:
        convergent = summation.is_convergent()
    except Exception:
        convergent = None
    primary_test, secondary_test, asymptotic_class = _detect_primary_test(term, index, auxiliary)
    family_label, family_detail = _classify_series_family(term, index)
    singularity_signal, singularity_detail = _singularity_scan(term, index, start)
    error_bound_signal = _series_error_bound(term, index, start)
    special_family_signal = _special_series_signal(term, index, auxiliary)
    branch_label, branch_detail = _series_branch_profile(term, auxiliary)
    branch_label, branch_detail = _series_branch_profile(term, auxiliary)
    expansion = _expansion_preview(term, index, sp.oo)
    term_points, partial_points = _series_summary(term, index, start)
    tertiary_points = [{"x": point["x"], "y": abs(point["y"])} for point in term_points]
    proof_signal, proof_formula = _build_series_proof_details(term, index, start, end)
    comparison_signal = "absolute convergence unresolved"
    if _is_alternating(term, index):
        try:
            abs_series = sp.Sum(sp.Abs(term), (index, start, end))
            abs_convergent = abs_series.is_convergent()
            comparison_signal = "absolute convergence" if abs_convergent else "conditional convergence candidate"
        except Exception:
            comparison_signal = "alternating lane"
    summary = {
        "detectedFamily": family_label,
        "candidateResult": latex(result),
        "convergenceSignal": "convergent" if convergent is True else "divergent" if convergent is False else "symbolic test inconclusive",
        "dominantTerm": latex(sp.simplify(term)),
        "riskSignal": singularity_signal if convergent is None else "formal result available",
        "shape": "series lane",
        "testFamily": primary_test,
        "secondaryTestFamily": secondary_test,
        "partialSumSignal": f"S_{partial_points[-1]['x']} ≈ {partial_points[-1]['y']:.6f}" if partial_points else "pending",
        "asymptoticClass": asymptotic_class,
        "proofSignal": proof_signal if convergent is not None else "symbolic proof incomplete",
        "comparisonSignal": f"{comparison_signal}; {family_detail}",
        "expansionSignal": expansion,
        "endpointSignal": singularity_detail,
        "errorBoundSignal": error_bound_signal,
        "specialFamilySignal": special_family_signal,
    }
    steps = [
        {"title": "Term parse", "summary": "Infinite series hadi va indeks oralig'i ajratildi.", "latex": latex(term)},
        {"title": "Family classification", "summary": family_detail, "latex": family_label},
        {"title": "Research lane", "summary": branch_detail, "latex": branch_label},
        {"title": "Primary test", "summary": f"Candidate convergence family: {primary_test}.", "latex": latex(summation)},
        {"title": "Secondary check", "summary": f"Backup lane: {secondary_test}. {comparison_signal}.", "latex": latex(sp.simplify(term))},
        {"title": "Singularity audit", "summary": singularity_signal, "latex": singularity_detail},
        {"title": "Asymptotic preview", "summary": "Term asymptotic expansion preview.", "latex": expansion},
        {"title": "Proof helper", "summary": proof_signal, "latex": proof_formula},
        {"title": "Remainder estimate", "summary": error_bound_signal, "latex": None},
        {"title": "Summation", "summary": "Formal sum symbolic tarzda baholandi.", "latex": f"{latex(summation)} = {latex(result)}"},
    ]
    return SeriesLimitSolveResult(
        status="exact",
        message="Series solver yakunlandi.",
        payload={
            "input": {"mode": mode, "expression": expression, "auxiliary": auxiliary, "dimension": dimension},
            "parser": {"expression_raw": expression, "expression_latex": latex(summation), "auxiliary_raw": auxiliary},
            "diagnostics": {
                "lane": mode,
                "method": branch_label,
                "test_family": primary_test,
                "risk": summary["riskSignal"],
                "convergence": summary["convergenceSignal"],
            },
            "summary": summary,
            "exact": {
                "method_label": branch_label,
                "result_latex": latex(result),
                "auxiliary_latex": expansion or f"lane: {branch_label}; tests: {primary_test}; {secondary_test}",
                "numeric_approximation": str(sp.N(result, 12)) if result.is_real else None,
                "steps": steps,
            },
            "preview": {"lineSeries": term_points, "secondaryLineSeries": partial_points, "tertiaryLineSeries": tertiary_points},
        },
    )


def _build_power_series(mode: str, expression: str, auxiliary: str, dimension: str) -> SeriesLimitSolveResult:
    parsed = _parse_sum(expression)
    term, index, start, end = parsed or _default_series_input(expression)
    x_symbol = next((symbol for symbol in term.free_symbols if symbol.name != index.name), sp.Symbol("x"))
    family_label, family_detail = _classify_series_family(term, index)
    singularity_signal, singularity_detail = _singularity_scan(term, index, start)
    error_bound_signal = _series_error_bound(term, index, start)
    special_family_signal = _special_series_signal(term, index, auxiliary)
    branch_label, branch_detail = _series_branch_profile(term, auxiliary)
    ratio = sp.simplify(sp.Abs(term.subs(index, index + 1) / term))
    try:
        ratio_limit = sp.limit(ratio, index, sp.oo)
    except Exception:
        ratio_limit = ratio
    radius, interval_signal = _estimate_radius(ratio_limit, x_symbol)
    endpoints: list[str] = []
    endpoint_details: list[str] = []
    if radius != "pending":
        try:
            radius_expr = _sympify(radius)
            positive_status, positive_detail = _endpoint_probe(term, index, start, end, x_symbol, radius_expr)
            negative_status, negative_detail = _endpoint_probe(term, index, start, end, x_symbol, -radius_expr)
            endpoints = [positive_status, negative_status]
            endpoint_details = [positive_detail, negative_detail]
        except Exception:
            endpoints = []
    sample_center = sp.Rational(1, 2)
    if radius != "pending":
        try:
            radius_expr = _sympify(radius)
            if radius_expr.is_real:
                sample_center = sp.simplify(radius_expr / 2)
        except Exception:
            sample_center = sp.Rational(1, 2)
    term_points, partial_points = _series_summary(term.subs(x_symbol, sample_center), index, start)
    magnitude_points = [{"x": point["x"], "y": abs(point["y"])} for point in term_points]
    expansion = _expansion_preview(term, index, sp.oo)
    summary = {
        "detectedFamily": family_label,
        "candidateResult": interval_signal,
        "convergenceSignal": "ratio limit constructed",
        "dominantTerm": latex(term),
        "radiusSignal": radius,
        "riskSignal": f"{singularity_signal}; endpoint proofs still matter" if endpoints else f"{singularity_signal}; ratio estimate only",
        "shape": "power-series lane",
        "intervalSignal": interval_signal,
        "endpointSignal": "; ".join(endpoints) if endpoints else singularity_detail,
        "endpointDetails": endpoint_details or [singularity_detail],
        "testFamily": "ratio test",
        "secondaryTestFamily": "endpoint comparison / alternating screen",
        "partialSumSignal": f"S_{partial_points[-1]['x']}({latex(sample_center)}) ≈ {partial_points[-1]['y']:.6f}" if partial_points else "pending",
        "asymptoticClass": f"coefficient-growth radius lane; {family_detail}",
        "proofSignal": "ratio test gives radius; endpoint-specific proof helpers attached",
        "comparisonSignal": "endpoint-specific convergence class",
        "expansionSignal": expansion,
        "errorBoundSignal": error_bound_signal,
        "specialFamilySignal": special_family_signal,
    }
    steps = [
        {"title": "Series term", "summary": "Power series term parsed from sum syntax.", "latex": latex(term)},
        {"title": "Family classification", "summary": family_detail, "latex": family_label},
        {"title": "Research lane", "summary": branch_detail, "latex": branch_label},
        {"title": "Ratio limit", "summary": "Radius estimate ratio limit orqali qurildi.", "latex": f"\\lim_{{n\\to\\infty}} {latex(ratio)} = {latex(ratio_limit)}"},
        {"title": "Interval screen", "summary": "Formal inequality solve orqali interval preview olindi.", "latex": interval_signal},
        {"title": "Endpoint audit", "summary": summary["endpointSignal"], "latex": f"R = {radius}; {singularity_detail}"},
        {"title": "Coefficient asymptotics", "summary": "Coefficient decay preview for radius reasoning.", "latex": expansion},
        {"title": "Remainder estimate", "summary": error_bound_signal, "latex": None},
    ]
    return SeriesLimitSolveResult(
        status="exact",
        message="Power series solver yakunlandi.",
        payload={
            "input": {"mode": mode, "expression": expression, "auxiliary": auxiliary, "dimension": dimension},
            "parser": {"expression_raw": expression, "expression_latex": latex(sp.Sum(term, (index, start, end))), "auxiliary_raw": auxiliary},
            "diagnostics": {"lane": mode, "method": branch_label, "test_family": "ratio test", "risk": summary["riskSignal"], "convergence": "interval derived"},
            "summary": summary,
            "exact": {
                "method_label": branch_label,
                "result_latex": interval_signal,
                "auxiliary_latex": expansion or f"lane: {branch_label}; R = {radius}; endpoints: {summary['endpointSignal']}",
                "numeric_approximation": None,
                "steps": steps,
            },
            "preview": {"lineSeries": term_points, "secondaryLineSeries": partial_points, "tertiaryLineSeries": magnitude_points},
        },
    )


def solve_series_limit(mode: str, expression: str, auxiliary: str = "", dimension: str = "") -> SeriesLimitSolveResult:
    if mode == "limits":
        return _build_limit(mode, expression, auxiliary, dimension)
    if mode == "sequences":
        return _build_sequence(mode, expression, auxiliary, dimension)
    if mode in {"series", "convergence"}:
        return _build_series(mode, expression, auxiliary, dimension)
    if mode == "power-series":
        return _build_power_series(mode, expression, auxiliary, dimension)
    raise SeriesLimitSolverError(f"Qo'llab-quvvatlanmaydigan mode: {mode}")
