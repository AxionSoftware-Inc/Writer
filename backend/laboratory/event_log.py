from __future__ import annotations

from typing import Any

from .models import LaboratoryEventLog


def log_laboratory_event(
    event_type: str,
    *,
    module: str = "",
    object_public_id: object | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    try:
        LaboratoryEventLog.objects.create(
            event_type=event_type,
            module=module or "",
            object_public_id=object_public_id,
            payload=payload or {},
        )
    except Exception:
        # Observability must never break the computational path.
        return
