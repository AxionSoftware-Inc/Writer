"""
differential_solver.py

Top-level dispatcher — mirrors integral_solver.py architecture.
Routes incoming differential requests to the appropriate lane.

Lanes:
  derivative  →  differential_lane_derivative.py
  partial     →  differential_lane_gradient.py
  directional →  differential_lane_gradient.py  (gradient = foundation)
  jacobian    →  differential_lane_jacobian.py
  hessian     →  differential_lane_hessian.py
"""
from __future__ import annotations

from .differential_lane_common import DifferentialSolveResult, DifferentialSolverError
from .differential_lane_derivative import solve_derivative_lane
from .differential_lane_gradient import solve_gradient_lane
from .differential_lane_jacobian import solve_jacobian_lane
from .differential_lane_hessian import solve_hessian_lane
from .differential_lane_ode import solve_ode_lane
from .differential_lane_pde import solve_pde_lane
from .differential_lane_sde import solve_sde_lane


def _parse_order(order_str: str) -> int:
    try:
        n = int(order_str.strip())
        return n if n >= 1 else 1
    except (ValueError, AttributeError):
        return 1


def solve_differential(
    mode: str,
    expression: str,
    variable: str,
    point: str,
    order: str = "1",
    direction: str = "",
    coordinates: str = "cartesian",
) -> DifferentialSolveResult:
    """
    Main entry point called by views.py.
    Validates mode and dispatches to the correct lane.
    """
    if not expression.strip():
        raise DifferentialSolverError("Ifoda bo'sh — differensial hisoblash uchun funksiya kerak.")

    if mode in {"derivative", "higher_order"}:
        return solve_derivative_lane(
            expression=expression,
            variable=variable,
            point=point,
            order=_parse_order(order),
        )

    if mode in {"partial", "gradient"}:
        return solve_gradient_lane(
            expression=expression,
            variable=variable,
            point=point,
            mode="gradient",
            direction=direction,
            coordinates=coordinates,
        )

    if mode == "directional":
        return solve_gradient_lane(
            expression=expression,
            variable=variable,
            point=point,
            mode="directional",
            direction=direction,
            coordinates=coordinates,
        )

    if mode == "jacobian":
        return solve_jacobian_lane(
            expression=expression,
            variable=variable,
            point=point,
        )

    if mode == "hessian":
        return solve_hessian_lane(
            expression=expression,
            variable=variable,
            point=point,
        )

    if mode == "ode":
        return solve_ode_lane(
            expression=expression,
            variable=variable,
            point=point,
        )

    if mode == "pde":
        return solve_pde_lane(
            expression=expression,
            variable=variable,
            point=point,
        )

    if mode == "sde":
        return solve_sde_lane(
            expression=expression,
            variable=variable,
            point=point,
        )

    raise DifferentialSolverError(
        f"Noma'lum differential mode: '{mode}'. "
        f"Qo'llab-quvvatlanadigan rejimlar: derivative, partial, directional, jacobian, hessian, ode, pde, sde."
    )
