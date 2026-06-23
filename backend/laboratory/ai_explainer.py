from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Iterator


class LaboratoryAIExplainerError(Exception):
    pass


LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234").rstrip("/")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "MathLLM-MathCoder-CL-7B.Q8_0")
LM_STUDIO_TIMEOUT_SECONDS = float(os.getenv("LM_STUDIO_TIMEOUT_SECONDS", "45"))
LM_STUDIO_STATUS_TIMEOUT_SECONDS = float(os.getenv("LM_STUDIO_STATUS_TIMEOUT_SECONDS", "2"))


def get_lm_studio_status() -> dict[str, Any]:
    started_at = time.monotonic()
    request = urllib.request.Request(f"{LM_STUDIO_BASE_URL}/v1/models", method="GET")
    try:
        with urllib.request.urlopen(request, timeout=LM_STUDIO_STATUS_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - status endpoint must not crash the lab UI.
        return {
            "available": False,
            "provider": "lm-studio",
            "base_url": LM_STUDIO_BASE_URL,
            "configured_model": LM_STUDIO_MODEL,
            "latency_ms": int((time.monotonic() - started_at) * 1000),
            "message": str(exc),
        }

    models = data.get("data") if isinstance(data, dict) else []
    model_ids = [str(item.get("id")) for item in models if isinstance(item, dict) and item.get("id")]
    return {
        "available": True,
        "provider": "lm-studio",
        "base_url": LM_STUDIO_BASE_URL,
        "configured_model": LM_STUDIO_MODEL,
        "models": model_ids[:20],
        "model_loaded": LM_STUDIO_MODEL in model_ids if model_ids else None,
        "latency_ms": int((time.monotonic() - started_at) * 1000),
    }


def _compact_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compacted = []
    for step in steps[:8]:
        compacted.append(
            {
                "title": str(step.get("title", ""))[:120],
                "summary": str(step.get("summary", ""))[:500],
                "latex": str(step.get("latex", ""))[:800] if step.get("latex") else None,
            }
        )
    return compacted


def build_ai_explanation_prompt(payload: dict[str, Any]) -> list[dict[str, str]]:
    expression_latex = payload.get("expression_latex") or payload.get("expression") or ""
    result_latex = payload.get("result_latex") or ""
    method = payload.get("method") or {}
    reproducibility = payload.get("reproducibility") or {}
    steps = _compact_steps(payload.get("steps") or [])

    user_payload = {
        "problem": {
            "expression": payload.get("expression", ""),
            "expression_latex": expression_latex,
            "lower": payload.get("lower", ""),
            "upper": payload.get("upper", ""),
        },
        "solver_method": method,
        "symbolic_result_latex": result_latex,
        "numeric_approximation": payload.get("numeric_approximation", ""),
        "sympy_steps": steps,
        "reproducibility": {
            "engine": reproducibility.get("engine"),
            "selected_method": reproducibility.get("selected_method"),
            "numeric_strategy": reproducibility.get("numeric_strategy"),
            "method_summary": reproducibility.get("method_summary"),
        },
    }

    return [
        {
            "role": "system",
            "content": (
                "You are a concise mathematical step writer. Return only step-by-step solution notes in Uzbek. "
                "Prompt schema version: mathsphere-ai-explain-v1. Solver output is source of truth; never invent a result. "
                "Do not add long introductions, broad theory, or unrelated suggestions. Use 4 to 6 numbered steps. "
                "Each step must be short: one title and one explanation. Do not write 'Explanation:', 'Let's proceed', "
                "or an answer box before the steps. Use $$...$$ for display LaTeX and $...$ for inline LaTeX."
            ),
        },
        {
            "role": "user",
            "content": (
                "Faqat step-by-step yoz. Agar DATA ichida kerakli natija yetarli bo'lmasa, aniq 'Eslatma: solver payload yetarli emas' deb yoz.\n"
                "Format:\n"
                "1. **Step title** - qisqa izoh.\n"
                "2. **Step title** - qisqa izoh.\n"
                "Birinchi qatordan darhol 1-stepni boshlang. 'Explanation' yoki kirish paragrafi yozmang. "
                "Formulalarni [ ... ] ko'rinishida yozmang; faqat $$...$$ yoki $...$ ishlating. "
                "Oxirida faqat bitta qisqa 'Eslatma' bo'lishi mumkin. Ortiqcha matn yozma.\n\n"
                f"DATA:\n{json.dumps(user_payload, ensure_ascii=False, indent=2)}"
            ),
        },
    ]


def request_lm_studio_explanation(payload: dict[str, Any]) -> dict[str, Any]:
    body = {
        "model": payload.get("model") or LM_STUDIO_MODEL,
        "messages": build_ai_explanation_prompt(payload),
        "temperature": float(payload.get("temperature") or 0.2),
        "max_tokens": int(payload.get("max_tokens") or 520),
        "stream": False,
    }
    request = urllib.request.Request(
        f"{LM_STUDIO_BASE_URL}/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=LM_STUDIO_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise LaboratoryAIExplainerError(
            f"LM Studio unavailable at {LM_STUDIO_BASE_URL}. Start LM Studio local server, load "
            f"{body['model']}, and enable the OpenAI-compatible endpoint. Raw error: {exc}"
        ) from exc
    except TimeoutError as exc:
        raise LaboratoryAIExplainerError("LM Studio request timed out.") from exc
    except json.JSONDecodeError as exc:
        raise LaboratoryAIExplainerError("LM Studio returned malformed JSON.") from exc

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LaboratoryAIExplainerError("LM Studio response did not include message content.") from exc

    return {
        "provider": "lm-studio",
        "model": body["model"],
        "content": content,
        "usage": data.get("usage") or {},
    }


def stream_lm_studio_explanation(payload: dict[str, Any]) -> Iterator[str]:
    body = {
        "model": payload.get("model") or LM_STUDIO_MODEL,
        "messages": build_ai_explanation_prompt(payload),
        "temperature": float(payload.get("temperature") or 0.15),
        "max_tokens": int(payload.get("max_tokens") or 520),
        "stream": True,
    }
    request = urllib.request.Request(
        f"{LM_STUDIO_BASE_URL}/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=LM_STUDIO_TIMEOUT_SECONDS) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line or not line.startswith("data:"):
                    continue
                data = line.removeprefix("data:").strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                    continue
    except urllib.error.URLError as exc:
        raise LaboratoryAIExplainerError(
            f"LM Studio unavailable at {LM_STUDIO_BASE_URL}. Start LM Studio local server, load "
            f"{body['model']}, and enable the OpenAI-compatible endpoint. Raw error: {exc}"
        ) from exc
    except TimeoutError as exc:
        raise LaboratoryAIExplainerError("LM Studio request timed out.") from exc
