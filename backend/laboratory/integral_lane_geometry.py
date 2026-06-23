from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GeometryLaneSpec:
    lane: str
    fields: dict[str, str]


def detect_geometry_lane(expression: str) -> str | None:
    normalized = expression.strip().lower()
    for lane in ("line", "surface", "contour"):
        if normalized.startswith(f"{lane}(") and normalized.endswith(")"):
            return lane
    return None


def parse_geometry_expression(expression: str, lane: str) -> GeometryLaneSpec:
    raw = expression.strip()
    prefix = f"{lane}("
    if not raw.lower().startswith(prefix) or not raw.endswith(")"):
        raise ValueError(f"{lane} lane syntax expected.")

    inner = raw[len(prefix):-1].strip()
    parts = _split_top_level(inner)
    fields: dict[str, str] = {}
    pending_index = 0

    for part in parts:
        if "=" in part:
            key, value = part.split("=", 1)
            fields[key.strip().lower()] = value.strip()
            continue
        if ":[" in part and part.endswith("]"):
            key, value = part.split(":[", 1)
            fields[key.strip().lower()] = f"[{value.strip()}"
            continue
        fields[f"arg_{pending_index}"] = part.strip()
        pending_index += 1

    return GeometryLaneSpec(lane=lane, fields=fields)


def parse_interval(raw_interval: str) -> tuple[str, str]:
    interval = raw_interval.strip()
    if not (interval.startswith("[") and interval.endswith("]")):
        raise ValueError("Interval syntax [start,end] expected.")
    left, right = _split_top_level(interval[1:-1])
    return left.strip(), right.strip()


def parse_tuple(raw_tuple: str, expected_length: int | None = None) -> list[str]:
    tuple_text = raw_tuple.strip()
    if not (tuple_text.startswith("(") and tuple_text.endswith(")")):
        raise ValueError("Tuple syntax (a,b,...) expected.")
    parts = [part.strip() for part in _split_top_level(tuple_text[1:-1])]
    if expected_length is not None and len(parts) != expected_length:
        raise ValueError(f"Expected {expected_length} tuple entries, got {len(parts)}.")
    return parts


def _split_top_level(text: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth = 0

    for char in text:
        if char in "([":
            depth += 1
        elif char in ")]":
            depth = max(0, depth - 1)

        if char == "," and depth == 0:
            token = "".join(current).strip()
            if token:
                parts.append(token)
            current = []
            continue

        current.append(char)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts
