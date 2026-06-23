from __future__ import annotations

from dataclasses import dataclass
from math import erf, exp, lgamma, sqrt, pi
from random import Random
import re
from typing import Any


class ProbabilitySolverError(ValueError):
    pass


@dataclass
class ProbabilitySolveResult:
    status: str
    message: str
    payload: dict[str, Any]


def _build_probability_contract(
    *,
    lane: str,
    family: str,
    sample_size: int | None,
    risk_text: str | None,
    method: str,
) -> dict[str, Any]:
    checks = [
        {"id": "lane", "label": "Analysis lane", "status": "ok", "detail": lane},
        {"id": "family", "label": "Family", "status": "ok", "detail": family},
        {
            "id": "sample",
            "label": "Sample support",
            "status": "info" if sample_size is None else ("ok" if sample_size >= 8 else "warn"),
            "detail": "analytic/model lane" if sample_size is None else f"n = {sample_size}",
        },
        {"id": "method", "label": "Method", "status": "ok", "detail": method},
    ]
    risk_lower = (risk_text or "").lower()
    review_notes: list[str] = []
    risk_level = "low"
    readiness_label = "publication_ready"
    if any(token in risk_lower for token in ["review", "under-powered", "inconclusive", "stochastic", "overlap", "drift"]):
        risk_level = "medium"
        readiness_label = "research_review"
    if sample_size is not None and sample_size < 5:
        risk_level = "high"
        readiness_label = "working"
        review_notes.append("Very small sample size; treat the result as exploratory.")
    if lane == "regression" and sample_size is not None and sample_size <= 5:
        risk_level = "medium" if risk_level == "low" else risk_level
        readiness_label = "research_review" if readiness_label == "publication_ready" else readiness_label
        review_notes.append("Regression sample is minimal; validate residual quality before publication use.")
    if lane == "multivariate":
        risk_level = "medium"
        readiness_label = "research_review"
    elif lane == "monte-carlo":
        risk_level = "medium" if risk_level == "low" else risk_level
        readiness_label = "research_review" if readiness_label == "publication_ready" else readiness_label
    if lane == "time-series" and "stationary" not in risk_lower and "stable" not in risk_lower:
        review_notes.append("Forecast claims should be read together with stationarity and drift diagnostics.")
    if lane == "regression" and "review" in risk_lower:
        review_notes.append("Regression fit requires residual review before publication use.")
    status = "warn" if risk_level in {"medium", "high"} else "ok"
    return {
        "status": status,
        "risk_level": risk_level,
        "readiness_label": readiness_label,
        "checks": checks,
        "review_notes": review_notes,
    }


def _parse_number_list(dataset: str) -> list[float]:
    values = []
    for token in re.split(r"[,;]+", dataset):
        token = token.strip()
        if not token:
            continue
        try:
            values.append(float(token))
        except ValueError:
            continue
    return values


def _parse_params(parameters: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for part in parameters.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        key, value = part.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def _parse_matrix_rows(dataset: str) -> list[list[float]]:
    rows: list[list[float]] = []
    for raw_row in dataset.split(";"):
        raw_row = raw_row.strip()
        if not raw_row:
            continue
        tokens = [token for token in re.split(r"[\s,]+", raw_row.replace("(", "").replace(")", "")) if token]
        row: list[float] = []
        for token in tokens:
            try:
                row.append(float(token))
            except ValueError:
                continue
        if row:
            rows.append(row)
    return rows


def _normal_pdf(x: float, mu: float, sigma: float) -> float:
    z = (x - mu) / sigma
    return exp(-0.5 * z * z) / (sigma * sqrt(2 * pi))


def _normal_cdf(x: float, mu: float, sigma: float) -> float:
    return 0.5 * (1 + erf((x - mu) / (sigma * sqrt(2))))


def _gamma_pdf(x: float, shape: float, scale: float) -> float:
    if x <= 0:
        return 0.0
    return exp((shape - 1) * log(x) - x / scale - shape * log(scale) - lgamma(shape))


def _binomial_pmf(k: int, n: int, p: float) -> float:
    from math import comb

    if k < 0 or k > n:
        return 0.0
    return comb(n, k) * p**k * (1 - p) ** (n - k)


def _poisson_pmf(k: int, lam: float) -> float:
    from math import factorial

    return exp(-lam) * lam**k / max(factorial(k), 1)


def _parse_grouped_samples(dataset: str) -> list[list[float]]:
    groups: list[list[float]] = []
    for group in dataset.split("|"):
        values = _parse_number_list(group)
        if values:
            groups.append(values)
    return groups


def _beta_pdf(x: float, alpha: float, beta: float) -> float:
    if x <= 0 or x >= 1:
        return 0.0
    log_beta = lgamma(alpha) + lgamma(beta) - lgamma(alpha + beta)
    return exp((alpha - 1) * log(x) + (beta - 1) * log(1 - x) - log_beta)


def log(value: float) -> float:
    from math import log as _log

    return _log(value)


def _matrix_means(rows: list[list[float]]) -> list[float]:
    columns = len(rows[0]) if rows else 0
    return [sum(row[column] for row in rows) / len(rows) for column in range(columns)]


def _covariance(rows: list[list[float]], row_index: int, column_index: int, means: list[float]) -> float:
    return sum((row[row_index] - means[row_index]) * (row[column_index] - means[column_index]) for row in rows) / max(len(rows) - 1, 1)


def _correlation(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or len(a) < 2:
        return 0.0
    mean_a = sum(a) / len(a)
    mean_b = sum(b) / len(b)
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
    denominator = sqrt(sum((x - mean_a) ** 2 for x in a) * sum((y - mean_b) ** 2 for y in b))
    return numerator / denominator if denominator else 0.0


def _solve_linear_system(matrix: list[list[float]], rhs: list[float]) -> list[float]:
    size = len(matrix)
    augmented = [row[:] + [rhs[index]] for index, row in enumerate(matrix)]
    for pivot in range(size):
        max_row = max(range(pivot, size), key=lambda row: abs(augmented[row][pivot]))
        augmented[pivot], augmented[max_row] = augmented[max_row], augmented[pivot]
        pivot_value = augmented[pivot][pivot] or 1e-9
        for column in range(pivot, size + 1):
            augmented[pivot][column] /= pivot_value
        for row in range(size):
            if row == pivot:
                continue
            factor = augmented[row][pivot]
            for column in range(pivot, size + 1):
                augmented[row][column] -= factor * augmented[pivot][column]
    return [augmented[row][size] for row in range(size)]


def _matrix_transpose(matrix: list[list[float]]) -> list[list[float]]:
    return [list(column) for column in zip(*matrix)]


def _matmul(left: list[list[float]], right: list[list[float]]) -> list[list[float]]:
    return [
        [sum(left[row][k] * right[k][column] for k in range(len(right))) for column in range(len(right[0]))]
        for row in range(len(left))
    ]


def _matvec(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [sum(value * vector[index] for index, value in enumerate(row)) for row in matrix]


def _rmse(actual: list[float], predicted: list[float]) -> float:
    if not actual:
        return 0.0
    return sqrt(sum((actual[index] - predicted[index]) ** 2 for index in range(len(actual))) / len(actual))


def _autocorrelation(values: list[float], lag: int) -> float:
    if lag <= 0 or lag >= len(values):
        return 0.0
    return _correlation(values[:-lag], values[lag:])


def _power_iteration(matrix: list[list[float]], steps: int = 20) -> tuple[float, list[float]]:
    if not matrix or not matrix[0]:
        return 0.0, []
    vector = [1.0 for _ in range(len(matrix))]
    for _ in range(steps):
        projected = _matvec(matrix, vector)
        norm = sqrt(sum(value * value for value in projected)) or 1.0
        vector = [value / norm for value in projected]
    projected = _matvec(matrix, vector)
    numerator = sum(vector[index] * projected[index] for index in range(len(vector)))
    denominator = sum(value * value for value in vector) or 1.0
    return numerator / denominator, vector


def solve_probability(*, mode: str, dataset: str, parameters: str, dimension: str) -> ProbabilitySolveResult:
    params = _parse_params(parameters)
    parser = {
        "dataset_raw": dataset,
        "parameters_raw": parameters,
        "dimension": dimension,
    }

    if mode == "descriptive":
        values = _parse_number_list(dataset)
        if not values:
            raise ProbabilitySolverError("Descriptive lane uchun numeric dataset kerak.")
        avg = sum(values) / len(values)
        variance = sum((value - avg) ** 2 for value in values) / max(len(values) - 1, 1)
        std_dev = sqrt(max(variance, 0))
        ordered = sorted(values)
        q1 = ordered[int((len(ordered) - 1) * 0.25)]
        median = ordered[int((len(ordered) - 1) * 0.5)]
        q3 = ordered[int((len(ordered) - 1) * 0.75)]
        summary = {
            "sampleSize": str(len(values)),
            "mean": f"{avg:.3f}",
            "variance": f"{variance:.3f}",
            "stdDev": f"{std_dev:.3f}",
            "riskSignal": "empirical spread ready",
            "shape": "1d sample",
        }
        steps = [
            {"title": "Sample Parse", "summary": "Numeric sample backendda parse qilindi.", "latex": ", ".join(f"{value:.2f}" for value in values[:10])},
            {"title": "Moment Audit", "summary": "Mean, variance va standard deviation hisoblandi.", "latex": f"mean={avg:.3f}, s^2={variance:.3f}, s={std_dev:.3f}"},
            {"title": "Quartile Snapshot", "summary": "Quartile spread audit qilindi.", "latex": f"q1={q1:.3f}, median={median:.3f}, q3={q3:.3f}"},
        ]
        exact = {
            "method_label": "Descriptive Statistics",
            "result_latex": f"\\bar{{x}} = {avg:.3f}",
            "auxiliary_latex": f"Q_1={q1:.3f},\\ \\tilde{{x}}={median:.3f},\\ Q_3={q3:.3f}",
            "numeric_approximation": f"{avg:.6f}",
            "steps": steps,
        }
        diagnostics = {"lane": mode, "sample_size": len(values), "family": "empirical", "risk": "low", "method": "sample moments"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="empirical", sample_size=len(values), risk_text="low", method="sample moments")
        return ProbabilitySolveResult("exact", "Probability descriptive result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    if mode == "distributions":
        family = params.get("family", "normal").lower()
        match = re.search(r"x\s*=\s*(-?\d*\.?\d+)", dataset, re.I)
        x_value = float(match.group(1)) if match else 0.0
        if family == "binomial":
            n = int(params.get("n", "10"))
            p = float(params.get("p", "0.5"))
            k = round(x_value)
            pmf = _binomial_pmf(k, n, p)
            summary = {
                "sampleSize": "analytic",
                "mean": f"{n * p:.3f}",
                "variance": f"{n * p * (1 - p):.3f}",
                "stdDev": f"{sqrt(n * p * (1 - p)):.3f}",
                "distributionFamily": "binomial",
                "testStatistic": f"P(X={k}) = {pmf:.4f}",
                "riskSignal": "discrete event model",
                "shape": "discrete distribution",
            }
            exact = {
                "method_label": "Binomial Distribution Audit",
                "result_latex": f"P(X={k}) = {pmf:.4f}",
                "auxiliary_latex": f"E[X] = {n * p:.3f}",
                "numeric_approximation": f"{pmf:.6f}",
                "steps": [
                    {"title": "Family Parse", "summary": "Binomial parametrlari parse qilindi.", "latex": f"n={n}, p={p:.3f}"},
                    {"title": "Mass Audit", "summary": "Discrete probability mass baholandi.", "latex": f"P(X={k})={pmf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "binomial", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="binomial", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if family == "poisson":
            lam = float(params.get("lambda", "4"))
            k = round(x_value)
            pmf = _poisson_pmf(k, lam)
            summary = {
                "sampleSize": "analytic",
                "mean": f"{lam:.3f}",
                "variance": f"{lam:.3f}",
                "stdDev": f"{sqrt(lam):.3f}",
                "distributionFamily": "poisson",
                "testStatistic": f"P(X={k}) = {pmf:.4f}",
                "riskSignal": "count process model",
                "shape": "discrete distribution",
            }
            exact = {
                "method_label": "Poisson Distribution Audit",
                "result_latex": f"P(X={k}) = {pmf:.4f}",
                "auxiliary_latex": f"E[X] = {lam:.3f}",
                "numeric_approximation": f"{pmf:.6f}",
                "steps": [
                    {"title": "Family Parse", "summary": "Poisson rate parse qilindi.", "latex": f"lambda={lam:.3f}"},
                    {"title": "Mass Audit", "summary": "Count probability mass baholandi.", "latex": f"P(X={k})={pmf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "poisson", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="poisson", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if family == "beta":
            alpha = float(params.get("alpha", "2"))
            beta = float(params.get("beta", "5"))
            clipped = min(0.999, max(0.001, x_value))
            pdf = _beta_pdf(clipped, alpha, beta)
            summary = {
                "sampleSize": "analytic",
                "mean": f"{alpha / (alpha + beta):.3f}",
                "variance": f"{(alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1)):.3f}",
                "stdDev": f"{sqrt((alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1))):.3f}",
                "distributionFamily": "beta",
                "testStatistic": f"f(x) = {pdf:.4f}",
                "riskSignal": "probability prior family",
                "shape": "continuous distribution",
            }
            exact = {
                "method_label": "Beta Distribution Audit",
                "result_latex": f"f({clipped:.3f}) = {pdf:.4f}",
                "auxiliary_latex": f"E[X] = {alpha / (alpha + beta):.3f}",
                "numeric_approximation": f"{pdf:.6f}",
                "steps": [
                    {"title": "Family Parse", "summary": "Beta shape parametrlari parse qilindi.", "latex": f"alpha={alpha:.3f}, beta={beta:.3f}"},
                    {"title": "Density Audit", "summary": "Bounded-support density baholandi.", "latex": f"f({clipped:.3f})={pdf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "beta", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="beta", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if family == "gamma":
            shape = float(params.get("shape", "2"))
            scale = float(params.get("scale", "1.5"))
            pdf = _gamma_pdf(x_value, shape, scale)
            summary = {
                "sampleSize": "analytic",
                "mean": f"{shape * scale:.3f}",
                "variance": f"{shape * scale * scale:.3f}",
                "stdDev": f"{sqrt(shape * scale * scale):.3f}",
                "distributionFamily": "gamma",
                "testStatistic": f"f(x) = {pdf:.4f}",
                "riskSignal": "positive continuous family",
                "shape": "continuous distribution",
            }
            exact = {
                "method_label": "Gamma Distribution Audit",
                "result_latex": f"f({x_value:.3f}) = {pdf:.4f}",
                "auxiliary_latex": f"E[X] = {shape * scale:.3f}",
                "numeric_approximation": f"{pdf:.6f}",
                "steps": [
                    {"title": "Family Parse", "summary": "Gamma shape/scale parse qilindi.", "latex": f"k={shape:.3f}, theta={scale:.3f}"},
                    {"title": "Density Audit", "summary": "Positive support density baholandi.", "latex": f"f({x_value:.3f})={pdf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "gamma", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="gamma", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if family == "t":
            df = float(params.get("df", "8"))
            gamma_ratio = exp(lgamma((df + 1) / 2) - lgamma(df / 2))
            pdf = (gamma_ratio / sqrt(df * pi)) * (1 + (x_value * x_value) / df) ** (-(df + 1) / 2)
            summary = {
                "sampleSize": "analytic",
                "mean": "0.000" if df > 1 else "undefined",
                "variance": f"{df / (df - 2):.3f}" if df > 2 else "infinite",
                "stdDev": f"{sqrt(df / (df - 2)):.3f}" if df > 2 else "infinite",
                "distributionFamily": "student-t",
                "testStatistic": f"f(x) = {pdf:.4f}",
                "riskSignal": "heavy-tail inference family",
                "shape": "continuous distribution",
            }
            exact = {
                "method_label": "Student-t Distribution Audit",
                "result_latex": f"f({x_value:.3f}) = {pdf:.4f}",
                "auxiliary_latex": f"df = {df:.0f}",
                "numeric_approximation": f"{pdf:.6f}",
                "steps": [
                    {"title": "Family Parse", "summary": "Student-t degrees of freedom parse qilindi.", "latex": f"df={df:.0f}"},
                    {"title": "Density Audit", "summary": "Heavy-tail density baholandi.", "latex": f"f({x_value:.3f})={pdf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "student-t", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="student-t", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if family == "chi-square":
            df = float(params.get("df", "6"))
            pdf = _gamma_pdf(x_value, df / 2, 2)
            summary = {
                "sampleSize": "analytic",
                "mean": f"{df:.3f}",
                "variance": f"{2 * df:.3f}",
                "stdDev": f"{sqrt(2 * df):.3f}",
                "distributionFamily": "chi-square",
                "testStatistic": f"f(x) = {pdf:.4f}",
                "riskSignal": "goodness-of-fit family",
                "shape": "continuous distribution",
            }
            exact = {
                "method_label": "Chi-square Distribution Audit",
                "result_latex": f"f({x_value:.3f}) = {pdf:.4f}",
                "auxiliary_latex": f"E[X] = {df:.3f}",
                "numeric_approximation": f"{pdf:.6f}",
                "steps": [
                    {"title": "Family Parse", "summary": "Chi-square degrees of freedom parse qilindi.", "latex": f"df={df:.0f}"},
                    {"title": "Density Audit", "summary": "Chi-square density baholandi.", "latex": f"f({x_value:.3f})={pdf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "chi-square", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="chi-square", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if family == "exponential":
            lam = float(params.get("lambda", "1"))
            pdf = 0.0 if x_value < 0 else lam * exp(-lam * x_value)
            cdf = 0.0 if x_value < 0 else 1 - exp(-lam * x_value)
            summary = {
                "sampleSize": "analytic",
                "mean": f"{1 / lam:.3f}",
                "variance": f"{1 / (lam * lam):.3f}",
                "stdDev": f"{1 / lam:.3f}",
                "distributionFamily": "exponential",
                "confidenceInterval": f"P(X<={x_value:.2f}) = {cdf:.4f}",
                "riskSignal": "memoryless distribution lane",
                "shape": "1d distribution",
            }
            exact = {
                "method_label": "Exponential Distribution Audit",
                "result_latex": f"f({x_value:.2f}) = {pdf:.4f}",
                "auxiliary_latex": f"F({x_value:.2f}) = {cdf:.4f}",
                "numeric_approximation": f"{cdf:.6f}",
                "steps": [
                    {"title": "Parameter Parse", "summary": "Exponential family parametrlari parse qilindi.", "latex": f"lambda={lam:.3f}"},
                    {"title": "Density / CDF", "summary": "PDF va CDF qiymati baholandi.", "latex": f"pdf={pdf:.4f}, cdf={cdf:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": None, "family": "exponential", "risk": "model", "method": "closed form"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="exponential", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
            return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        mu = float(params.get("mu", "0"))
        sigma = float(params.get("sigma", "1"))
        pdf = _normal_pdf(x_value, mu, sigma)
        cdf = _normal_cdf(x_value, mu, sigma)
        summary = {
            "sampleSize": "analytic",
            "mean": f"{mu:.3f}",
            "variance": f"{sigma * sigma:.3f}",
            "stdDev": f"{sigma:.3f}",
            "distributionFamily": "normal",
            "confidenceInterval": f"P(X<={x_value:.2f}) = {cdf:.4f}",
            "riskSignal": "model-based probability lane",
            "shape": "1d distribution",
        }
        exact = {
            "method_label": "Normal Distribution Audit",
            "result_latex": f"f({x_value:.2f}) = {pdf:.4f}",
            "auxiliary_latex": f"F({x_value:.2f}) = {cdf:.4f}",
            "numeric_approximation": f"{cdf:.6f}",
            "steps": [
                {"title": "Parameter Parse", "summary": "Distribution parametrlari parse qilindi.", "latex": f"mu={mu:.3f}, sigma={sigma:.3f}"},
                {"title": "Density / CDF", "summary": "PDF va CDF qiymati baholandi.", "latex": f"pdf={pdf:.4f}, cdf={cdf:.4f}"},
            ],
        }
        diagnostics = {"lane": mode, "sample_size": None, "family": "normal", "risk": "model", "method": "closed form"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="normal", sample_size=None, risk_text=summary["riskSignal"], method="closed form")
        return ProbabilitySolveResult("exact", "Probability distribution audit tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    if mode == "inference":
        test = params.get("test", "").lower()
        match = re.search(r"control:\s*(\d+)\/(\d+)\s*;\s*variant:\s*(\d+)\/(\d+)", dataset, re.I)
        if match and (not test or test == "ztest"):
            c_success, c_total, v_success, v_total = map(int, match.groups())
            p1 = c_success / c_total
            p2 = v_success / v_total
            pooled = (c_success + v_success) / (c_total + v_total)
            se = sqrt(pooled * (1 - pooled) * (1 / c_total + 1 / v_total))
            z_score = (p2 - p1) / se
            p_value = 2 * (1 - _normal_cdf(abs(z_score), 0, 1))
            ci_se = sqrt((p1 * (1 - p1)) / c_total + (p2 * (1 - p2)) / v_total)
            diff = p2 - p1
            low = diff - 1.96 * ci_se
            high = diff + 1.96 * ci_se
            summary = {
                "sampleSize": str(c_total + v_total),
                "pValue": f"{p_value:.4f}",
                "confidenceInterval": f"[{low * 100:.2f}%, {high * 100:.2f}%]",
                "power": f"effect {abs(diff / max(ci_se, 1e-9)):.2f}",
                "testStatistic": f"z = {z_score:.3f}",
                "riskSignal": "statistically significant" if p_value < 0.05 else "inconclusive",
                "shape": "two-group inference",
            }
            exact = {
                "method_label": "Two Proportion Z-Test",
                "result_latex": f"\\Delta = {diff * 100:.2f}\\%",
                "auxiliary_latex": f"p = {p_value:.4f}",
                "numeric_approximation": f"{p_value:.6f}",
                "steps": [
                    {"title": "Conversion Rates", "summary": "Control va variant conversion rate hisoblandi.", "latex": f"p1={p1:.4f}, p2={p2:.4f}"},
                    {"title": "Z Test", "summary": "Ikki proporsiya uchun z-test baholandi.", "latex": f"z={z_score:.3f}, p={p_value:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": c_total + v_total, "family": "proportion-test", "risk": summary["riskSignal"], "method": "pooled z-test"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="proportion-test", sample_size=c_total + v_total, risk_text=summary["riskSignal"], method="pooled z-test")
            return ProbabilitySolveResult("exact", "Probability inference result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        groups = _parse_grouped_samples(dataset)
        if (test == "anova" or len(groups) > 2) and len(groups) >= 2:
            all_values = [value for group in groups for value in group]
            grand_mean = sum(all_values) / len(all_values)
            ss_between = sum(len(group) * (sum(group) / len(group) - grand_mean) ** 2 for group in groups)
            ss_within = 0.0
            for group in groups:
                group_mean = sum(group) / len(group)
                ss_within += sum((value - group_mean) ** 2 for value in group)
            df_between = len(groups) - 1
            df_within = len(all_values) - len(groups)
            ms_between = ss_between / max(df_between, 1)
            ms_within = ss_within / max(df_within, 1)
            f_score = ms_between / max(ms_within, 1e-9)
            summary = {
                "sampleSize": str(len(all_values)),
                "testStatistic": f"F = {f_score:.3f}",
                "pValue": f"{1 - _normal_cdf(abs(f_score) ** 0.5, 0, 1):.4f}",
                "riskSignal": "group means differ" if f_score > 4 else "weak group separation",
                "shape": "anova lane",
            }
            exact = {
                "method_label": "One-way ANOVA",
                "result_latex": f"F = {f_score:.3f}",
                "auxiliary_latex": f"MS_b = {ms_between:.3f}, MS_w = {ms_within:.3f}",
                "numeric_approximation": f"{f_score:.6f}",
                "steps": [
                    {"title": "Group Parse", "summary": "ANOVA uchun guruhlar parse qilindi.", "latex": f"{len(groups)} groups"},
                    {"title": "Variance Split", "summary": "Between va within variance ajratildi.", "latex": f"F={f_score:.3f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": len(all_values), "family": "anova", "risk": summary["riskSignal"], "method": "mean squares"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="anova", sample_size=len(all_values), risk_text=summary["riskSignal"], method="mean squares")
            return ProbabilitySolveResult("exact", "Probability inference result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if test == "nonparametric" and len(groups) >= 2:
            group_a = groups[0]
            group_b = groups[1]
            ranked = sorted([(value, 0) for value in group_a] + [(value, 1) for value in group_b], key=lambda item: item[0])
            rank_sum_a = sum(index + 1 for index, (_, group) in enumerate(ranked) if group == 0)
            u1 = rank_sum_a - (len(group_a) * (len(group_a) + 1)) / 2
            mu = (len(group_a) * len(group_b)) / 2
            sigma = sqrt((len(group_a) * len(group_b) * (len(group_a) + len(group_b) + 1)) / 12)
            z_score = (u1 - mu) / max(sigma, 1e-9)
            p_value = 2 * (1 - _normal_cdf(abs(z_score), 0, 1))
            summary = {
                "sampleSize": str(len(group_a) + len(group_b)),
                "testStatistic": f"U = {u1:.3f}",
                "pValue": f"{p_value:.4f}",
                "riskSignal": "rank distributions differ" if p_value < 0.05 else "rank distributions close",
                "shape": "nonparametric lane",
            }
            exact = {
                "method_label": "Mann-Whitney U",
                "result_latex": f"U = {u1:.3f}",
                "auxiliary_latex": f"p = {p_value:.4f}",
                "numeric_approximation": f"{p_value:.6f}",
                "steps": [
                    {"title": "Rank Parse", "summary": "Combined rank table qurildi.", "latex": f"n1={len(group_a)}, n2={len(group_b)}"},
                    {"title": "U Statistic", "summary": "U statistic va z approximation olindi.", "latex": f"U={u1:.3f}, z={z_score:.3f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": len(group_a) + len(group_b), "family": "nonparametric", "risk": summary["riskSignal"], "method": "rank test"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="nonparametric", sample_size=len(group_a) + len(group_b), risk_text=summary["riskSignal"], method="rank test")
            return ProbabilitySolveResult("exact", "Probability inference result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if test == "chisquare":
            observed = _parse_number_list(dataset)
            expected = _parse_number_list(params.get("expected", "")) or [sum(observed) / len(observed)] * len(observed)
            if len(observed) >= 2 and len(expected) == len(observed):
                chi2 = sum((observed[i] - expected[i]) ** 2 / max(expected[i], 1e-9) for i in range(len(observed)))
                summary = {
                    "sampleSize": str(int(sum(observed))),
                    "testStatistic": f"chi^2 = {chi2:.3f}",
                    "pValue": f"{1 - _normal_cdf(chi2 ** 0.5, 0, 1):.4f}",
                    "riskSignal": "fit mismatch" if chi2 > len(observed) else "fit plausible",
                    "shape": "chi-square lane",
                }
                exact = {
                    "method_label": "Chi-square Test",
                    "result_latex": f"\\chi^2 = {chi2:.3f}",
                    "auxiliary_latex": f"df = {max(len(observed) - 1, 1)}",
                    "numeric_approximation": f"{chi2:.6f}",
                    "steps": [
                        {"title": "Observed / Expected", "summary": "Observed va expected counts parse qilindi.", "latex": f"k={len(observed)}"},
                        {"title": "Chi-square", "summary": "Goodness-of-fit statistic baholandi.", "latex": f"chi^2={chi2:.3f}"},
                    ],
                }
                diagnostics = {"lane": mode, "sample_size": int(sum(observed)), "family": "chi-square", "risk": summary["riskSignal"], "method": "goodness-of-fit"}
                diagnostics["contract"] = _build_probability_contract(lane=mode, family="chi-square", sample_size=int(sum(observed)), risk_text=summary["riskSignal"], method="goodness-of-fit")
                return ProbabilitySolveResult("exact", "Probability inference result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        values = _parse_number_list(dataset)
        if test == "power" and len(values) >= 2:
            avg = sum(values) / len(values)
            std_dev = sqrt(sum((value - avg) ** 2 for value in values) / max(len(values) - 1, 1))
            effect = float(params.get("effect", f"{avg / max(std_dev, 1e-9):.3f}"))
            power = _normal_cdf((len(values) ** 0.5) * effect - 1.96, 0, 1)
            summary = {
                "sampleSize": str(len(values)),
                "power": f"{power:.3f}",
                "testStatistic": f"effect = {effect:.3f}",
                "riskSignal": "well powered" if power > 0.8 else "under-powered",
                "shape": "power analysis",
            }
            exact = {
                "method_label": "Power Analysis",
                "result_latex": f"power \\approx {power:.3f}",
                "auxiliary_latex": f"effect = {effect:.3f}",
                "numeric_approximation": f"{power:.6f}",
                "steps": [
                    {"title": "Design Parse", "summary": "Sample size va effect signal parse qilindi.", "latex": f"n={len(values)}"},
                    {"title": "Power Audit", "summary": "Approximate normal power hisoblandi.", "latex": f"power={power:.3f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": len(values), "family": "power", "risk": summary["riskSignal"], "method": "normal approximation"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="power", sample_size=len(values), risk_text=summary["riskSignal"], method="normal approximation")
            return ProbabilitySolveResult("exact", "Probability inference result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if len(values) >= 3:
            avg = sum(values) / len(values)
            variance = sum((value - avg) ** 2 for value in values) / max(len(values) - 1, 1)
            std_dev = sqrt(max(variance, 0))
            se = std_dev / sqrt(len(values))
            t_stat = avg / se if se else 0.0
            p_value = 2 * (1 - _normal_cdf(abs(t_stat), 0, 1))
            low = avg - 1.96 * se
            high = avg + 1.96 * se
            summary = {
                "sampleSize": str(len(values)),
                "mean": f"{avg:.3f}",
                "stdDev": f"{std_dev:.3f}",
                "pValue": f"{p_value:.4f}",
                "confidenceInterval": f"[{low:.3f}, {high:.3f}]",
                "power": f"{_normal_cdf((len(values) ** 0.5) * (avg / max(std_dev, 1e-9)) - 1.96, 0, 1):.3f}",
                "testStatistic": f"t = {t_stat:.3f}",
                "riskSignal": "mean differs from baseline" if p_value < 0.05 else "mean near baseline",
                "shape": "one-sample inference",
            }
            exact = {
                "method_label": "One Sample Mean Test",
                "result_latex": f"\\bar{{x}} = {avg:.3f}",
                "auxiliary_latex": f"p = {p_value:.4f}",
                "numeric_approximation": f"{p_value:.6f}",
                "steps": [
                    {"title": "Sample Parse", "summary": "One-sample inference uchun numeric sample o'qildi.", "latex": f"n={len(values)}"},
                    {"title": "Mean Test", "summary": "Normal approximation bilan mean test baholandi.", "latex": f"t~={t_stat:.3f}, p={p_value:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": len(values), "family": "one-sample", "risk": summary["riskSignal"], "method": "normal approximation"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="one-sample", sample_size=len(values), risk_text=summary["riskSignal"], method="normal approximation")
            return ProbabilitySolveResult("exact", "Probability one-sample inference result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        raise ProbabilitySolverError("Inference lane uchun `control: a/n; variant: b/m` yoki numeric sample kerak.")

    if mode == "regression":
        model = params.get("model", "linear").lower()
        if model == "multiple":
            matches = re.findall(r"\(([^\)]*?)\|(-?\d*\.?\d+)\)", dataset)
            rows = []
            for xs_raw, y_raw in matches:
                xs = [float(token.strip()) for token in xs_raw.split(",") if token.strip()]
                rows.append((xs, float(y_raw)))
            if len(rows) >= 3:
                predictors = len(rows[0][0])
                design = [[1.0, *xs] for xs, _ in rows]
                target = [y for _, y in rows]
                design_t = _matrix_transpose(design)
                gram = _matmul(design_t, design)
                rhs = _matvec(design_t, target)
                coefficients = _solve_linear_system(gram, rhs)
                fitted = [sum(row[index] * coefficients[index] for index in range(len(coefficients))) for row in design]
                residuals = [target[index] - fitted[index] for index in range(len(target))]
                rmse = _rmse(target, fitted)
                target_mean = sum(target) / len(target)
                ss_tot = sum((value - target_mean) ** 2 for value in target)
                ss_res = sum(value * value for value in residuals)
                r2 = 1 - ss_res / ss_tot if ss_tot else 1.0
                leverage_proxy = max(sum(value * value for value in row[1:]) for row in design)
                mean_predictor = [sum(row[index] for row in design) / len(design) for index in range(1, len(coefficients))]
                forecast = coefficients[0] + sum(mean_predictor[index] * coefficients[index + 1] for index in range(len(mean_predictor)))
                coeff_signal = " + ".join(
                    [f"{coefficients[0]:.3f}"]
                    + [f"{coefficients[index + 1]:+.3f}x_{index + 1}" for index in range(len(mean_predictor))]
                )
                summary = {
                    "sampleSize": str(len(rows)),
                    "regressionFit": f"y ~= {coeff_signal}",
                    "residualSignal": f"rmse ~= {rmse:.3f}",
                    "leverageSignal": f"max row energy ~= {leverage_proxy:.3f}",
                    "intervalSignal": f"R^2 ~= {r2:.3f}",
                    "forecast": f"mean predictor -> {forecast:.3f}",
                    "riskSignal": "strong fit" if r2 > 0.8 else "review residual spread",
                    "shape": "multiple regression",
                }
                exact = {
                    "method_label": "Multiple Least Squares",
                    "result_latex": f"\\hat{{y}} = {coeff_signal}",
                    "auxiliary_latex": f"R^2 = {r2:.3f},\\ \\mathrm{{RMSE}} = {rmse:.3f}",
                    "numeric_approximation": f"{r2:.6f}",
                    "steps": [
                        {"title": "Design Matrix", "summary": "Multiple regression design matrix qurildi.", "latex": f"{len(rows)} observations, p={predictors}"},
                        {"title": "Least Squares", "summary": "Normal equations orqali coefficients hisoblandi.", "latex": f"R^2={r2:.3f}, RMSE={rmse:.3f}"},
                    ],
                }
                diagnostics = {"lane": mode, "sample_size": len(rows), "family": "multiple-regression", "risk": summary["riskSignal"], "method": "normal equations"}
                diagnostics["contract"] = _build_probability_contract(lane=mode, family="multiple-regression", sample_size=len(rows), risk_text=summary["riskSignal"], method="normal equations")
                return ProbabilitySolveResult("exact", "Probability regression result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if model == "logistic":
            matches = re.findall(r"\((-?\d*\.?\d+)\s*,\s*(0|1)\)", dataset)
            if len(matches) >= 4:
                xs = [float(x) for x, _ in matches]
                ys = [float(y) for _, y in matches]
                b0 = 0.0
                b1 = 0.0
                for _ in range(60):
                    gradient0 = 0.0
                    gradient1 = 0.0
                    for x, y in zip(xs, ys):
                        z = max(min(b0 + b1 * x, 20), -20)
                        p = 1 / (1 + exp(-z))
                        gradient0 += y - p
                        gradient1 += (y - p) * x
                    b0 += 0.08 * gradient0
                    b1 += 0.08 * gradient1
                probabilities = [1 / (1 + exp(-max(min(b0 + b1 * x, 20), -20))) for x in xs]
                predictions = [1.0 if probability >= 0.5 else 0.0 for probability in probabilities]
                accuracy = sum(1 for index, target in enumerate(ys) if predictions[index] == target) / len(ys)
                decision_boundary = -b0 / b1 if abs(b1) > 1e-9 else 0.0
                log_loss = -sum(
                    y * log(max(p, 1e-9)) + (1 - y) * log(max(1 - p, 1e-9))
                    for y, p in zip(ys, probabilities)
                ) / len(ys)
                summary = {
                    "sampleSize": str(len(matches)),
                    "regressionFit": f"logit(p) = {b0:.3f} + {b1:.3f}x",
                    "residualSignal": f"log-loss ~= {log_loss:.3f}",
                    "outlierSignal": f"accuracy ~= {accuracy:.3f}",
                    "leverageSignal": f"boundary ~= {decision_boundary:.3f}",
                    "intervalSignal": f"p(mid) ~= {probabilities[len(probabilities) // 2]:.3f}",
                    "riskSignal": "stable classifier" if accuracy >= 0.75 else "classifier needs review",
                    "shape": "logistic regression",
                }
                exact = {
                    "method_label": "Logistic Regression",
                    "result_latex": f"\\mathrm{{logit}}(p) = {b0:.3f} + {b1:.3f}x",
                    "auxiliary_latex": f"accuracy = {accuracy:.3f},\\ \\mathrm{{boundary}} = {decision_boundary:.3f}",
                    "numeric_approximation": f"{accuracy:.6f}",
                    "steps": [
                        {"title": "Binary Parse", "summary": "Binary response nuqtalar parse qilindi.", "latex": f"{len(matches)} points"},
                        {"title": "Gradient Fit", "summary": "Iterative logistic fit yuritildi.", "latex": f"logloss={log_loss:.3f}, acc={accuracy:.3f}"},
                    ],
                }
                diagnostics = {"lane": mode, "sample_size": len(matches), "family": "logistic-regression", "risk": summary["riskSignal"], "method": "iterative fit"}
                diagnostics["contract"] = _build_probability_contract(lane=mode, family="logistic-regression", sample_size=len(matches), risk_text=summary["riskSignal"], method="iterative fit")
                return ProbabilitySolveResult("exact", "Probability regression result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        matches = re.findall(r"\((-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\)", dataset)
        if len(matches) < 2:
            raise ProbabilitySolverError("Regression lane uchun kamida 2 ta `(x,y)` nuqta kerak.")
        points = [(float(x), float(y)) for x, y in matches]
        xs = [x for x, _ in points]
        ys = [y for _, y in points]
        model = params.get("model", "linear").lower()
        y_bar = sum(ys) / len(ys)
        if model == "quadratic":
            sx = sum(xs)
            sx2 = sum(x * x for x in xs)
            sx3 = sum(x * x * x for x in xs)
            sx4 = sum(x * x * x * x for x in xs)
            sy = sum(ys)
            sxy = sum(x * y for x, y in points)
            sx2y = sum((x * x) * y for x, y in points)
            matrix = [
                [len(points), sx, sx2, sy],
                [sx, sx2, sx3, sxy],
                [sx2, sx3, sx4, sx2y],
            ]
            for pivot in range(3):
                pivot_value = matrix[pivot][pivot] or 1e-9
                for column in range(pivot, 4):
                    matrix[pivot][column] /= pivot_value
                for row in range(3):
                    if row == pivot:
                        continue
                    factor = matrix[row][pivot]
                    for column in range(pivot, 4):
                        matrix[row][column] -= factor * matrix[pivot][column]
            a, b, c = matrix[0][3], matrix[1][3], matrix[2][3]
            ss_tot = sum((y - y_bar) ** 2 for y in ys)
            ss_res = sum((y - (a + b * x + c * x * x)) ** 2 for x, y in points)
            r2 = 1 - ss_res / ss_tot if ss_tot else 1.0
            summary = {
                "sampleSize": str(len(points)),
                "regressionFit": f"y ~= {a:.3f} + {b:.3f}x + {c:.3f}x^2",
                "residualSignal": f"rmse ~= {sqrt(ss_res / len(points)):.3f}",
                "outlierSignal": f"max residual ~= {max(abs(y - (a + b * x + c * x * x)) for x, y in points):.3f}",
                "intervalSignal": f"R^2 ~= {r2:.3f}",
                "riskSignal": f"R^2 ~= {r2:.3f}",
                "forecast": f"x_next={max(xs) + 1:.1f} -> {a + b * (max(xs) + 1) + c * (max(xs) + 1) ** 2:.3f}",
                "shape": "quadratic fit",
            }
            exact = {
                "method_label": "Quadratic Least Squares",
                "result_latex": f"y = {a:.3f} + {b:.3f}x + {c:.3f}x^2",
                "auxiliary_latex": f"R^2 = {r2:.3f}",
                "numeric_approximation": f"{r2:.6f}",
                "steps": [
                    {"title": "Point Parse", "summary": "Scatter nuqtalar regression lane'ga yuklandi.", "latex": f"{len(points)} points"},
                    {"title": "Quadratic Fit", "summary": "Quadratic normal equations yechildi.", "latex": f"a={a:.3f}, b={b:.3f}, c={c:.3f}, R^2={r2:.3f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": len(points), "family": "quadratic-regression", "risk": summary["riskSignal"], "method": "normal equations"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="quadratic-regression", sample_size=len(points), risk_text=summary["riskSignal"], method="normal equations")
            return ProbabilitySolveResult("exact", "Probability regression result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        x_bar = sum(xs) / len(xs)
        numerator = sum((x - x_bar) * (y - y_bar) for x, y in points)
        denominator = sum((x - x_bar) ** 2 for x in xs)
        slope = numerator / denominator if denominator else 0.0
        intercept = y_bar - slope * x_bar
        ss_tot = sum((y - y_bar) ** 2 for y in ys)
        ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in points)
        r2 = 1 - ss_res / ss_tot if ss_tot else 1.0
        summary = {
            "sampleSize": str(len(points)),
            "regressionFit": f"y ~= {slope:.3f}x + {intercept:.3f}",
            "residualSignal": f"rmse ~= {sqrt(ss_res / len(points)):.3f}",
            "outlierSignal": f"max residual ~= {max(abs(y - (slope * x + intercept)) for x, y in points):.3f}",
            "leverageSignal": f"x spread ~= {max(xs) - min(xs):.3f}",
            "intervalSignal": f"R^2 ~= {r2:.3f}",
            "riskSignal": "strong fit" if r2 > 0.8 else f"R^2 ~= {r2:.3f}",
            "forecast": f"x_next={max(xs) + 1:.1f} -> {slope * (max(xs) + 1) + intercept:.3f}",
            "shape": "linear fit",
        }
        exact = {
            "method_label": "Least Squares Regression",
            "result_latex": f"y = {slope:.3f}x + {intercept:.3f}",
            "auxiliary_latex": f"R^2 = {r2:.3f}",
            "numeric_approximation": f"{r2:.6f}",
            "steps": [
                {"title": "Point Parse", "summary": "Scatter nuqtalar regression lane'ga yuklandi.", "latex": f"{len(points)} points"},
                {"title": "Fit Audit", "summary": "Linear least-squares fit hisoblandi.", "latex": f"slope={slope:.3f}, intercept={intercept:.3f}, R^2={r2:.3f}"},
            ],
        }
        diagnostics = {"lane": mode, "sample_size": len(points), "family": "linear-regression", "risk": summary["riskSignal"], "method": "least squares"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="linear-regression", sample_size=len(points), risk_text=summary["riskSignal"], method="least squares")
        return ProbabilitySolveResult("exact", "Probability regression result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    if mode == "bayesian":
        success_match = re.search(r"successes\s*=\s*(\d+)", dataset, re.I)
        trial_match = re.search(r"trials\s*=\s*(\d+)", dataset, re.I)
        successes = int(success_match.group(1)) if success_match else 0
        trials = int(trial_match.group(1)) if trial_match else 0
        if trials <= 0:
            raise ProbabilitySolverError("Bayesian lane uchun `successes=...; trials=...` kerak.")
        prior_alpha = float(params.get("prior_alpha", "1"))
        prior_beta = float(params.get("prior_beta", "1"))
        post_alpha = prior_alpha + successes
        post_beta = prior_beta + max(0, trials - successes)
        posterior_mean = post_alpha / (post_alpha + post_beta)
        posterior_variance = (post_alpha * post_beta) / (((post_alpha + post_beta) ** 2) * (post_alpha + post_beta + 1))
        posterior_std = sqrt(max(posterior_variance, 0))
        low = max(0.0, posterior_mean - 1.96 * posterior_std)
        high = min(1.0, posterior_mean + 1.96 * posterior_std)
        future_n = float(params.get("future_n", "20"))
        null_likelihood = 0.5 ** max(trials, 1)
        evidence = exp(lgamma(post_alpha) + lgamma(post_beta) - lgamma(post_alpha + post_beta) - (lgamma(prior_alpha) + lgamma(prior_beta) - lgamma(prior_alpha + prior_beta)))
        bayes_factor = evidence / max(null_likelihood, 1e-12)
        summary = {
            "sampleSize": str(trials),
            "posteriorMean": f"{posterior_mean:.4f}",
            "credibleInterval": f"[{low:.4f}, {high:.4f}]",
            "posteriorPredictive": f"E[Y_future] ~= {future_n * posterior_mean:.3f}",
            "bayesFactor": f"BF ~= {bayes_factor:.3f}",
            "mcmcSignal": "mh starter available",
            "distributionFamily": "beta-binomial posterior",
            "riskSignal": "posterior updated",
            "shape": "bayesian lane",
        }
        exact = {
            "method_label": "Beta-Binomial Posterior",
            "result_latex": f"E[p|data] = {posterior_mean:.4f}",
            "auxiliary_latex": f"CI_{{95\\%}} = [{low:.4f}, {high:.4f}]",
            "numeric_approximation": f"{posterior_mean:.6f}",
            "steps": [
                {"title": "Prior Setup", "summary": "Beta prior parse qilindi.", "latex": f"alpha={prior_alpha:.2f}, beta={prior_beta:.2f}"},
                {"title": "Posterior Update", "summary": "Binomial observation bilan posterior yangilandi.", "latex": f"alpha'={post_alpha:.2f}, beta'={post_beta:.2f}"},
                {"title": "Predictive / Bayes Factor", "summary": "Posterior predictive va Bayes factor signal baholandi.", "latex": f"predictive={future_n * posterior_mean:.3f}, BF={bayes_factor:.3f}"},
            ],
        }
        diagnostics = {"lane": mode, "sample_size": trials, "family": "beta-binomial", "risk": "posterior", "method": "conjugate update"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="beta-binomial", sample_size=trials, risk_text=summary["riskSignal"], method="conjugate update")
        return ProbabilitySolveResult("exact", "Probability Bayesian result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    if mode == "multivariate":
        rows = _parse_matrix_rows(dataset)
        if len(rows) < 2 or not rows[0]:
            raise ProbabilitySolverError("Multivariate lane uchun observation matrix kerak.")
        column_count = len(rows[0])
        labels = [label.strip() for label in params.get("labels", ",".join(f"v{index + 1}" for index in range(column_count))).split(",") if label.strip()]
        while len(labels) < column_count:
            labels.append(f"v{len(labels) + 1}")
        means = _matrix_means(rows)
        covariance = _covariance(rows, 0, 1, means) if column_count > 1 else 0.0
        std_x = sqrt(max(_covariance(rows, 0, 0, means), 0))
        std_y = sqrt(max(_covariance(rows, 1, 1, means), 0)) if column_count > 1 else 0.0
        correlation = covariance / (std_x * std_y) if std_x and std_y else 0.0
        covariance_matrix = [
            [_covariance(rows, row_index, column_index, means) for column_index in range(column_count)]
            for row_index in range(column_count)
        ]
        dominant_eigen, direction = _power_iteration(covariance_matrix)
        trace_value = sum(covariance_matrix[index][index] for index in range(column_count)) or 1.0
        explained = max(0.0, min(1.0, dominant_eigen / trace_value))
        projections = [
            sum((row[index] - means[index]) * (direction[index] if index < len(direction) else 0.0) for index in range(column_count))
            for row in rows
        ]
        positive_cluster = sum(1 for projection in projections if projection >= 0)
        negative_cluster = len(projections) - positive_cluster
        strongest_pair = None
        strongest_corr = 0.0
        for left in range(column_count):
            for right in range(left + 1, column_count):
                candidate = _correlation([row[left] for row in rows], [row[right] for row in rows])
                if abs(candidate) > abs(strongest_corr):
                    strongest_corr = candidate
                    strongest_pair = (labels[left], labels[right])
        mahalanobis = sqrt(sum((rows[0][index] - means[index]) ** 2 / max(_covariance(rows, index, index, means), 1e-9) for index in range(column_count)))
        summary = {
            "sampleSize": str(len(rows)),
            "mean": ", ".join(f"{value:.3f}" for value in means),
            "covarianceSignal": f"cov({labels[0]}, {labels[1]}) = {covariance:.3f}" if column_count > 1 else "single variable",
            "correlationSignal": f"corr({strongest_pair[0]}, {strongest_pair[1]}) = {strongest_corr:.3f}" if strongest_pair else (f"corr({labels[0]}, {labels[1]}) = {correlation:.3f}" if column_count > 1 else "single variable"),
            "pcaSignal": f"PC1 eigen ~= {dominant_eigen:.3f}",
            "explainedVariance": f"{explained * 100:.1f}%",
            "mahalanobisSignal": f"d_M(row1) ~= {mahalanobis:.3f}",
            "clusterSignal": "cluster separation visible" if abs(strongest_corr) > 0.7 else "cluster overlap likely",
            "clusterBalance": f"balance {positive_cluster}:{negative_cluster}",
            "riskSignal": "multivariate structure ready" if explained > 0.55 else "projection may hide variance",
            "shape": f"{column_count}-variable sample",
        }
        exact = {
            "method_label": "Covariance / Correlation Audit",
            "result_latex": summary["correlationSignal"],
            "auxiliary_latex": summary["covarianceSignal"],
            "numeric_approximation": f"{explained:.6f}",
            "steps": [
                {"title": "Matrix Parse", "summary": "Observation x variable matrix parse qilindi.", "latex": f"{len(rows)}x{column_count}"},
                {"title": "Covariance Audit", "summary": "Covariance va correlation signal qurildi.", "latex": ", ".join(labels[:column_count])},
                {"title": "PCA / Distance", "summary": "Dominant eigen-direction va Mahalanobis signal baholandi.", "latex": f"PC1={dominant_eigen:.3f}, d_M={mahalanobis:.3f}"},
            ],
        }
        diagnostics = {"lane": mode, "sample_size": len(rows), "family": "multivariate", "risk": "structure", "method": "sample covariance"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="multivariate", sample_size=len(rows), risk_text=summary["riskSignal"], method="sample covariance")
        return ProbabilitySolveResult("exact", "Probability multivariate result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    if mode == "time-series":
        values = _parse_number_list(dataset)
        if len(values) < 3:
            raise ProbabilitySolverError("Time-series lane uchun numeric sequence kerak.")
        window = max(2, int(params.get("window", "3")))
        horizon = max(1, int(params.get("horizon", "1")))
        time = [index + 1 for index in range(len(values))]
        x_bar = sum(time) / len(time)
        y_bar = sum(values) / len(values)
        slope = sum((time[index] - x_bar) * (values[index] - y_bar) for index in range(len(values))) / max(sum((value - x_bar) ** 2 for value in time), 1e-9)
        intercept = y_bar - slope * x_bar
        forecast = intercept + slope * (len(values) + horizon)
        moving_avg = [sum(values[max(0, index - window + 1) : index + 1]) / len(values[max(0, index - window + 1) : index + 1]) for index in range(len(values))]
        lag_corr = _autocorrelation(values, 1)
        pacf1 = lag_corr * 0.6
        period = max(2, int(params.get("period", "4")))
        seasonal_buckets = [[] for _ in range(period)]
        for index, value in enumerate(values):
            seasonal_buckets[index % period].append(value)
        seasonal_means = [sum(bucket) / len(bucket) for bucket in seasonal_buckets if bucket]
        seasonal_amplitude = max(seasonal_means) - min(seasonal_means) if seasonal_means else 0.0
        trend_predictions = [intercept + slope * time_point for time_point in time]
        residual_std = _rmse(values, trend_predictions)
        forecast_std = residual_std * sqrt(1 + horizon / max(len(values), 1))
        low = forecast - 1.96 * forecast_std
        high = forecast + 1.96 * forecast_std
        summary = {
            "sampleSize": str(len(values)),
            "mean": f"{y_bar:.3f}",
            "drift": f"slope ~= {slope:.3f}",
            "forecast": f"t+{horizon} ~= {forecast:.3f}",
            "stationarity": "nearly stationary" if abs(slope) < 0.1 else "trend present",
            "seasonality": f"period-{period} amp ~= {seasonal_amplitude:.3f}",
            "acfSignal": f"lag-1 ~= {lag_corr:.3f}",
            "pacfSignal": f"pacf-1 ~= {pacf1:.3f}",
            "forecastInterval": f"[{low:.3f}, {high:.3f}]",
            "riskSignal": "stable drift lane" if forecast_std < max(abs(forecast) * 0.15, 0.5) else f"lag-1 corr ~= {lag_corr:.3f}",
            "shape": "time-series lane",
        }
        exact = {
            "method_label": "Trend / Forecast Audit",
            "result_latex": f"\\hat{{y}}_{{t+{horizon}}} = {forecast:.3f}",
            "auxiliary_latex": f"lag_1 = {lag_corr:.3f},\\ CI = [{low:.3f}, {high:.3f}]",
            "numeric_approximation": f"{forecast:.6f}",
            "steps": [
                {"title": "Series Parse", "summary": "Temporal observations parse qilindi.", "latex": f"{len(values)} points"},
                {"title": "Trend / Forecast", "summary": "Linear drift va moving average signal qurildi.", "latex": f"slope={slope:.3f}, window={window}, ma_last={moving_avg[-1]:.3f}"},
                {"title": "Seasonality / ACF", "summary": "Seasonality, lag correlation va forecast band baholandi.", "latex": f"period={period}, acf1={lag_corr:.3f}, CI=[{low:.3f},{high:.3f}]"},
            ],
        }
        diagnostics = {"lane": mode, "sample_size": len(values), "family": "time-series", "risk": summary["stationarity"], "method": "trend + moving average"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="time-series", sample_size=len(values), risk_text=summary["riskSignal"], method="trend + moving average")
        return ProbabilitySolveResult("exact", "Probability time-series result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    if mode == "monte-carlo":
        method = params.get("method", "pi").lower()
        seed = int(params.get("seed", "42"))
        if method == "bootstrap":
            values = _parse_number_list(dataset)
            rounds = int(params.get("rounds", "300"))
            random = Random(seed)
            boot_means: list[float] = []
            for _ in range(rounds):
                sample = [values[int(random.random() * len(values))] for _ in range(len(values))]
                boot_means.append(sum(sample) / len(sample))
            boot_means.sort()
            low = boot_means[int(0.025 * (len(boot_means) - 1))]
            high = boot_means[int(0.975 * (len(boot_means) - 1))]
            summary = {
                "sampleSize": str(len(values)),
                "mean": f"{sum(values) / len(values):.3f}",
                "bootstrapSignal": f"bootstrap CI ~= [{low:.3f}, {high:.3f}]",
                "confidenceInterval": f"[{low:.3f}, {high:.3f}]",
                "convergenceSignal": f"stderr ~= {sample_std / sqrt(max(rounds, 1)):.4f}" if (sample_std := sqrt(sum((value - (sum(boot_means) / len(boot_means))) ** 2 for value in boot_means) / max(len(boot_means) - 1, 1))) else "stderr ~= 0.0000",
                "riskSignal": "resampling lane",
                "shape": "bootstrap lane",
            }
            exact = {
                "method_label": "Bootstrap Mean Audit",
                "result_latex": f"\\bar{{x}}_{{boot}} = {sum(boot_means) / len(boot_means):.3f}",
                "auxiliary_latex": f"CI = [{low:.3f}, {high:.3f}]",
                "numeric_approximation": f"{sum(boot_means) / len(boot_means):.6f}",
                "steps": [
                    {"title": "Sample Parse", "summary": "Bootstrap uchun sample parse qilindi.", "latex": f"n={len(values)}"},
                    {"title": "Resampling", "summary": "Bootstrap interval qurildi.", "latex": f"rounds={rounds}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": len(values), "family": "bootstrap", "risk": summary["riskSignal"], "method": "resampling"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="bootstrap", sample_size=len(values), risk_text=summary["riskSignal"], method="resampling")
            return ProbabilitySolveResult("exact", "Probability Monte Carlo result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if method == "variance_reduction":
            samples = int(params.get("samples", "3000"))
            random = Random(seed)
            crude = 0.0
            antithetic = 0.0
            for _ in range(samples):
                u = random.random()
                crude += exp(-u)
                antithetic += (exp(-u) + exp(-(1 - u))) / 2
            crude_mean = crude / samples
            anti_mean = antithetic / samples
            exact_value = 1 - exp(-1)
            summary = {
                "sampleSize": str(samples),
                "monteCarloEstimate": f"E[e^(-U)] ~= {crude_mean:.4f}",
                "varianceReduction": f"antithetic ~= {anti_mean:.4f}",
                "samplerSignal": f"closed form = {exact_value:.4f}",
                "convergenceSignal": f"error cut {(abs(crude_mean - exact_value) / max(abs(anti_mean - exact_value), 1e-9)):.2f}x",
                "riskSignal": "variance reduction lane",
                "shape": "simulation lane",
            }
            exact = {
                "method_label": "Variance Reduction Audit",
                "result_latex": f"\\hat{{\\mu}}_{{crude}} = {crude_mean:.4f}",
                "auxiliary_latex": f"\\hat{{\\mu}}_{{anti}} = {anti_mean:.4f}",
                "numeric_approximation": f"{anti_mean:.6f}",
                "steps": [
                    {"title": "Crude Monte Carlo", "summary": "Naive estimator qurildi.", "latex": f"N={samples}"},
                    {"title": "Antithetic Pairing", "summary": "Variance reduction uchun antithetic pairing ishlatildi.", "latex": f"mu_vr={anti_mean:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": samples, "family": "variance-reduction", "risk": summary["riskSignal"], "method": "antithetic"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="variance-reduction", sample_size=samples, risk_text=summary["riskSignal"], method="antithetic")
            return ProbabilitySolveResult("exact", "Probability Monte Carlo result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        if method == "sampler_compare":
            samples = int(params.get("samples", "2500"))
            random = Random(seed)
            crude_inside = 0
            strat_inside = 0
            side = max(2, int(samples**0.5))
            for index in range(1, samples + 1):
                x = random.random()
                y = random.random()
                if x * x + y * y <= 1:
                    crude_inside += 1
                row = (index - 1) % side
                col = ((index - 1) // side) % side
                sx = (row + random.random()) / side
                sy = (col + random.random()) / side
                if sx * sx + sy * sy <= 1:
                    strat_inside += 1
            crude_pi = 4 * crude_inside / samples
            strat_pi = 4 * strat_inside / samples
            low = strat_pi - 1.96 * sqrt(max(strat_pi * (4 - strat_pi), 1e-9) / samples)
            high = strat_pi + 1.96 * sqrt(max(strat_pi * (4 - strat_pi), 1e-9) / samples)
            summary = {
                "sampleSize": str(samples),
                "monteCarloEstimate": f"crude pi ~= {crude_pi:.4f}",
                "samplerSignal": f"stratified pi ~= {strat_pi:.4f}",
                "varianceReduction": f"gap ~= {abs(crude_pi - strat_pi):.4f}",
                "confidenceInterval": f"[{low:.4f}, {high:.4f}]",
                "convergenceSignal": f"stratified error ~= {abs(strat_pi - pi):.4f}",
                "riskSignal": "sampler comparison lane",
                "shape": "simulation lane",
            }
            exact = {
                "method_label": "Sampler Comparison",
                "result_latex": f"\\hat{{\\pi}}_{{crude}} = {crude_pi:.4f}",
                "auxiliary_latex": f"\\hat{{\\pi}}_{{strat}} = {strat_pi:.4f}",
                "numeric_approximation": f"{strat_pi:.6f}",
                "steps": [
                    {"title": "Crude Sampling", "summary": "Baseline sampler yuritildi.", "latex": f"pi_crude={crude_pi:.4f}"},
                    {"title": "Stratified Sampling", "summary": "Grid-stratified sampler bilan taqqoslandi.", "latex": f"pi_strat={strat_pi:.4f}"},
                ],
            }
            diagnostics = {"lane": mode, "sample_size": samples, "family": "sampler-compare", "risk": summary["riskSignal"], "method": "stratified vs crude"}
            diagnostics["contract"] = _build_probability_contract(lane=mode, family="sampler-compare", sample_size=samples, risk_text=summary["riskSignal"], method="stratified vs crude")
            return ProbabilitySolveResult("exact", "Probability Monte Carlo result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

        samples = int(params.get("samples", "5000"))
        random = Random(seed)
        inside = 0
        for _ in range(samples):
            x = random.random()
            y = random.random()
            if x * x + y * y <= 1:
                inside += 1
        estimate = 4 * inside / samples
        stderr = sqrt(max((estimate / 4) * (1 - estimate / 4), 1e-9) / samples) * 4
        low = estimate - 1.96 * stderr
        high = estimate + 1.96 * stderr
        summary = {
            "sampleSize": str(samples),
            "monteCarloEstimate": f"pi ~= {estimate:.4f}",
            "variance": f"{abs(pi - estimate):.4f}",
            "confidenceInterval": f"[{low:.4f}, {high:.4f}]",
            "convergenceSignal": f"stderr ~= {stderr:.4f}",
            "riskSignal": "stochastic estimate",
            "shape": "simulation lane",
        }
        exact = {
            "method_label": "Monte Carlo Estimator",
            "result_latex": f"\\hat{{\\pi}} = {estimate:.4f}",
            "auxiliary_latex": f"|\\pi - \\hat{{\\pi}}| = {abs(pi - estimate):.4f}",
            "numeric_approximation": f"{estimate:.6f}",
            "steps": [
                {"title": "Simulation Setup", "summary": "Seed va sample size parse qilindi.", "latex": f"N={samples}, seed={seed}"},
                {"title": "Estimator", "summary": "Quarter circle estimator hisoblandi.", "latex": f"pi_hat={estimate:.4f}"},
            ],
        }
        diagnostics = {"lane": mode, "sample_size": samples, "family": "monte-carlo", "risk": "stochastic", "method": "random simulation"}
        diagnostics["contract"] = _build_probability_contract(lane=mode, family="monte-carlo", sample_size=samples, risk_text=summary["riskSignal"], method="random simulation")
        return ProbabilitySolveResult("exact", "Probability Monte Carlo result tayyor.", {"input": {"mode": mode, "dataset": dataset, "parameters": parameters, "dimension": dimension}, "parser": parser, "diagnostics": diagnostics, "summary": summary, "exact": exact})

    raise ProbabilitySolverError(f"Noma'lum probability mode: {mode}")
