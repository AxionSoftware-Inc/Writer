from __future__ import annotations

from .integral_lane_common import IntegralSolveResult, IntegralSolverError
from .integral_lane_contour import solve_contour_integral
from .integral_lane_definite import solve_definite_single_integral
from .integral_lane_geometry import detect_geometry_lane
from .integral_lane_improper import solve_improper_single_integral
from .integral_lane_indefinite import solve_indefinite_single_integral
from .integral_lane_line import solve_line_integral
from .integral_lane_surface import solve_surface_integral


def _has_endpoint_singularity(expression: str, lower: str, upper: str) -> bool:
    normalized = expression.replace(" ", "").lower()
    lower_value = lower.strip().lower()
    upper_value = upper.strip().lower()

    if "/x" in normalized and (lower_value == "0" or upper_value == "0"):
        return True
    if "log(x)" in normalized and lower_value == "0":
        return True
    if "sqrt(x)" in normalized and lower_value.startswith("-"):
        return True
    if "sqrt(x)" in normalized and lower_value == "0":
        return True
    return False


def solve_single_integral(expression: str, lower: str, upper: str, method: str = "auto") -> IntegralSolveResult:
    geometry_lane = detect_geometry_lane(expression)
    if geometry_lane == "line":
        return solve_line_integral(expression)
    if geometry_lane == "surface":
        return solve_surface_integral(expression)
    if geometry_lane == "contour":
        return solve_contour_integral(expression)

    normalized_lower = lower.strip()
    normalized_upper = upper.strip()

    if not normalized_lower or not normalized_upper:
        return solve_indefinite_single_integral(expression)

    lower_token = normalized_lower.lower()
    upper_token = normalized_upper.lower()
    improper_tokens = {"inf", "+inf", "-inf", "infinity", "+infinity", "-infinity", "oo", "+oo", "-oo", "∞", "+∞", "-∞"}

    if lower_token in improper_tokens or upper_token in improper_tokens:
        return solve_improper_single_integral(expression, lower, upper)

    if _has_endpoint_singularity(expression, lower, upper):
        return solve_improper_single_integral(expression, lower, upper)

    return solve_definite_single_integral(expression, lower, upper, method=method)
