import json
import re
from typing import Any


LAB_RESULT_BLOCK_REGEX = re.compile(r"```lab-result\n([\s\S]*?)\n```", re.MULTILINE)


def parse_lab_result_block(raw: str):
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return None
        if not isinstance(payload.get("id"), str):
            return None
        return payload
    except Exception:
        return None


def serialize_lab_result_block(block: dict[str, Any]) -> str:
    return f"```lab-result\n{json.dumps(block, indent=2)}\n```"


def extract_lab_result_blocks(content: str):
    blocks: list[dict[str, Any]] = []
    for match in LAB_RESULT_BLOCK_REGEX.finditer(content or ""):
        parsed = parse_lab_result_block(match.group(1))
        if parsed:
            blocks.append(parsed)
    return blocks


def extract_lab_result_targets(content: str):
    targets: list[dict[str, Any]] = []
    headings: list[str] = []
    lines = (content or "").splitlines()
    fence_mode: str | None = None
    buffer: list[str] = []

    for line in lines:
        trimmed = line.strip()

        if fence_mode == "lab-result":
            if trimmed == "```":
                parsed = parse_lab_result_block("\n".join(buffer))
                if parsed:
                    section_path = " > ".join([item for item in headings if item])
                    targets.append(
                        {
                            "id": parsed["id"],
                            "title": parsed.get("title") or "Laboratory block",
                            "profile": parsed.get("profile"),
                            "status": parsed.get("status") or "ready",
                            "generatedAt": parsed.get("generatedAt"),
                            "revision": ((parsed.get("sync") or {}).get("revision") if isinstance(parsed.get("sync"), dict) else None),
                            "lastPublishedAt": ((parsed.get("sync") or {}).get("pushedAt") if isinstance(parsed.get("sync"), dict) else None),
                            "lastAcknowledgedAt": ((parsed.get("sync") or {}).get("acknowledgedAt") if isinstance(parsed.get("sync"), dict) else None),
                            "sourceLabel": ((parsed.get("sync") or {}).get("sourceLabel") if isinstance(parsed.get("sync"), dict) else None),
                            "sectionLabel": headings[-1] if headings else None,
                            "sectionPath": section_path or None,
                            "savedResultId": parsed.get("savedResultId"),
                            "savedResultRevision": parsed.get("savedResultRevision"),
                            "moduleSlug": parsed.get("moduleSlug"),
                        }
                    )
                fence_mode = None
                buffer = []
                continue

            buffer.append(line)
            continue

        if fence_mode == "generic":
            if trimmed.startswith("```"):
                fence_mode = None
            continue

        if trimmed == "```lab-result":
            fence_mode = "lab-result"
            buffer = []
            continue

        if trimmed.startswith("```"):
            fence_mode = "generic"
            continue

        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", trimmed)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            if len(headings) < level:
                headings.extend([""] * (level - len(headings)))
            headings[level - 1] = title
            headings[:] = headings[:level]

    return targets


def replace_lab_result_block(content: str, next_block: dict[str, Any]):
    replaced = False

    def replacer(match: re.Match[str]):
        nonlocal replaced
        parsed = parse_lab_result_block(match.group(1))
        if not parsed or parsed.get("id") != next_block.get("id"):
            return match.group(0)
        replaced = True
        return serialize_lab_result_block(next_block)

    next_content = LAB_RESULT_BLOCK_REGEX.sub(replacer, content or "")
    if replaced:
        return next_content

    suffix = (content or "").rstrip()
    return f"{suffix}\n\n{serialize_lab_result_block(next_block)}\n"
