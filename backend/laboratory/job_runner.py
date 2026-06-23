from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from django.utils import timezone

from .event_log import log_laboratory_event
from .integral_solver import solve_single_integral
from .matrix_solver import solve_matrix
from .probability_solver import solve_probability
from .series_limit_solver import solve_series_limit
from .differential_solver import solve_differential
from .models import LaboratorySolveJob


EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="lab-solve")


def estimate_runtime_ms(module: str, payload: dict[str, Any]) -> int:
    complexity = len(str(payload))
    if module == "integral":
        method = payload.get("method", "auto")
        base = 1200 if method in {"auto", "symbolic"} else 2200
        if any(token in str(payload.get("expression", "")) for token in ("Piecewise", "Integral", "sqrt", "log")):
            base += 1600
        return min(120000, base + complexity * 4)
    if module in {"differential", "matrix"}:
        return min(90000, 1800 + complexity * 5)
    return min(60000, 1400 + complexity * 4)


def may_take_long(job: LaboratorySolveJob) -> bool:
    return job.estimated_runtime_ms >= 10000 or job.timeout_ms >= 60000


def submit_job(job: LaboratorySolveJob) -> None:
    EXECUTOR.submit(run_job, str(job.public_id))


def _run_payload(module: str, payload: dict[str, Any]) -> dict[str, Any]:
    if module == "integral":
        result = solve_single_integral(
            expression=str(payload.get("expression", "")),
            lower=str(payload.get("lower", "")),
            upper=str(payload.get("upper", "")),
            method=str(payload.get("method", "auto")),
        )
    elif module == "differential":
        result = solve_differential(
            mode=str(payload.get("mode", "derivative")),
            expression=str(payload.get("expression", "")),
            variable=str(payload.get("variable", "x")),
            point=str(payload.get("point", "1")),
            order=str(payload.get("order", "1")),
            direction=str(payload.get("direction", "")),
            coordinates=str(payload.get("coordinates", "cartesian")),
        )
    elif module == "matrix":
        result = solve_matrix(
            mode=str(payload.get("mode", "algebra")),
            expression=str(payload.get("expression", "")),
            rhs_expression=str(payload.get("rhs", "")),
            dimension=str(payload.get("dimension", "")),
        )
    elif module == "probability":
        result = solve_probability(
            mode=str(payload.get("mode", "descriptive")),
            dataset=str(payload.get("dataset", "")),
            parameters=str(payload.get("parameters", "")),
            dimension=str(payload.get("dimension", "")),
        )
    elif module == "series-limit":
        result = solve_series_limit(
            mode=str(payload.get("mode", "limits")),
            expression=str(payload.get("expression", "")),
            auxiliary=str(payload.get("auxiliary", "")),
            dimension=str(payload.get("dimension", "")),
        )
    else:
        raise ValueError(f"Unsupported job module: {module}")
    return {"status": result.status, "message": result.message, **result.payload}


def run_job(public_id: str) -> None:
    try:
        job = LaboratorySolveJob.objects.get(public_id=public_id)
    except LaboratorySolveJob.DoesNotExist:
        return

    if job.cancel_requested:
        job.status = "cancelled"
        job.progress = 100
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "progress", "finished_at", "updated_at"])
        log_laboratory_event("solve_job_cancelled", module=job.module, object_public_id=job.public_id)
        return

    job.status = "running"
    job.progress = 10
    job.attempts += 1
    job.started_at = timezone.now()
    job.save(update_fields=["status", "progress", "attempts", "started_at", "updated_at"])

    start = time.monotonic()
    try:
        time.sleep(0.05)
        job.refresh_from_db()
        if job.cancel_requested:
            job.status = "cancelled"
            job.progress = 100
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "progress", "finished_at", "updated_at"])
            log_laboratory_event("solve_job_cancelled", module=job.module, object_public_id=job.public_id)
            return

        job.progress = 45
        job.save(update_fields=["progress", "updated_at"])
        result = _run_payload(job.module, job.payload)

        elapsed_ms = int((time.monotonic() - start) * 1000)
        job.refresh_from_db()
        if job.cancel_requested:
            job.status = "cancelled"
            job.result = {"cancelled_after_ms": elapsed_ms}
        else:
            job.status = "completed"
            job.result = {
                **result,
                "runtime_ms": elapsed_ms,
                "long_running_warning": may_take_long(job),
            }
        job.progress = 100
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "result", "progress", "finished_at", "updated_at"])
        log_laboratory_event(
            "solve_job_completed" if job.status == "completed" else "solve_job_cancelled",
            module=job.module,
            object_public_id=job.public_id,
            payload={"runtime_ms": elapsed_ms, "cache_hit": job.cache_hit},
        )
    except Exception as exc:  # noqa: BLE001 - job error should be captured.
        job.status = "failed"
        job.error = str(exc)
        job.progress = 100
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "progress", "finished_at", "updated_at"])
        log_laboratory_event(
            "solve_job_failed",
            module=job.module,
            object_public_id=job.public_id,
            payload={"error": str(exc)[:500]},
        )
