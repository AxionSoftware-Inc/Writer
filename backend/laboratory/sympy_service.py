from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

from sympy import Abs, E, I, Symbol, cos, cot, exp, latex, log, oo, pi, simplify, sin, sqrt, sympify, tan
from sympy import acos, asin, atan, cosh, sinh, tanh
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)


TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application, convert_xor)

SYMPY_BASE_LOCALS = {
    "pi": pi,
    "e": E,
    "E": E,
    "I": I,
    "i": I,
    "sin": sin,
    "cos": cos,
    "tan": tan,
    "cot": cot,
    "asin": asin,
    "acos": acos,
    "atan": atan,
    "sinh": sinh,
    "cosh": cosh,
    "tanh": tanh,
    "exp": exp,
    "log": log,
    "ln": log,
    "sqrt": sqrt,
    "abs": Abs,
    "oo": oo,
}

NORMALIZATION_PATTERNS = (
    (re.compile(r"π"), "pi", "`π` `pi` ga o'girilgan."),
    (re.compile(r"∞"), "oo", "`∞` `oo` ko'rinishiga o'girilgan."),
    (re.compile(r"(?<![A-Za-z_])(?:inf|infinity)(?![A-Za-z_])", flags=re.IGNORECASE), "oo", "`inf` `oo` ko'rinishiga o'girilgan."),
    (re.compile(r"[−–—]"), "-", "Unicode minus oddiy `-` ko'rinishiga o'girilgan."),
    (re.compile(r"[×⋅·]"), "*", "Ko'paytirish belgisi `*` ko'rinishiga o'girilgan."),
    (re.compile(r"÷"), "/", "Bo'lish belgisi `/` ko'rinishiga o'girilgan."),
    (re.compile(r"√"), "sqrt", "`√` `sqrt` ko'rinishiga o'girilgan."),
    (re.compile(r"\bln\b", flags=re.IGNORECASE), "log", "`ln` `log` ga o'girilgan."),
    (re.compile(r"\btg\b", flags=re.IGNORECASE), "tan", "`tg` `tan` ga o'girilgan."),
    (re.compile(r"\bctg\b", flags=re.IGNORECASE), "cot", "`ctg` `cot` ga o'girilgan."),
    (re.compile(r"\barcsin\b", flags=re.IGNORECASE), "asin", "`arcsin` `asin` ga o'girilgan."),
    (re.compile(r"\barccos\b", flags=re.IGNORECASE), "acos", "`arccos` `acos` ga o'girilgan."),
    (re.compile(r"\barctan\b", flags=re.IGNORECASE), "atan", "`arctan` `atan` ga o'girilgan."),
)


class MathParserError(ValueError):
    pass


@dataclass
class ParsedMathInput:
    raw: str
    normalized: str
    expression: Any
    latex: str
    notes: list[str]


def build_sympy_locals(variable_names: Iterable[str] = ()) -> dict[str, Any]:
    local_dict = dict(SYMPY_BASE_LOCALS)
    for variable_name in variable_names:
        local_dict[variable_name] = Symbol(variable_name, real=True)
    return local_dict


def normalize_user_math_input(raw_value: str) -> tuple[str, list[str]]:
    text = raw_value.strip()
    if not text:
        raise MathParserError("Bo'sh ifoda yuborilmadi.")

    notes: list[str] = []
    normalized = text
    for pattern, replacement, note in NORMALIZATION_PATTERNS:
        updated = pattern.sub(replacement, normalized)
        if updated != normalized:
            normalized = updated
            notes.append(note)

    collapsed = re.sub(r"\s+", " ", normalized).strip()
    if collapsed != normalized:
        notes.append("Ortiqcha bo'shliqlar tozalandi.")

    return collapsed, _dedupe_notes(notes)


def parse_user_math_input(
    raw_value: str,
    *,
    label: str,
    variable_names: Iterable[str] = (),
    require_numeric: bool = False,
) -> ParsedMathInput:
    normalized, notes = normalize_user_math_input(raw_value)
    local_dict = build_sympy_locals(variable_names)
    allowed_symbols = {
        local_dict[name]
        for name in variable_names
        if isinstance(local_dict.get(name), Symbol)
    }

    try:
        parsed = parse_expr(
            normalized,
            local_dict=local_dict,
            transformations=TRANSFORMATIONS,
            evaluate=True,
        )
        parsed = sympify(parsed, locals=local_dict, evaluate=True)
    except Exception as exc:  # pragma: no cover
        raise MathParserError(f"{label} o'qilmadi: {exc}") from exc

    free_symbols = parsed.free_symbols - allowed_symbols
    if free_symbols:
        joined = ", ".join(sorted(str(symbol) for symbol in free_symbols))
        if require_numeric:
            raise MathParserError(f"{label} faqat sonli ifoda bo'lishi kerak.")
        raise MathParserError(f"{label} ichida ruxsat etilmagan o'zgaruvchilar topildi: {joined}.")

    if require_numeric and parsed.free_symbols:
        raise MathParserError(f"{label} faqat sonli ifoda bo'lishi kerak.")

    simplified = simplify(parsed)
    return ParsedMathInput(
        raw=raw_value,
        normalized=normalized,
        expression=simplified,
        latex=latex(simplified),
        notes=notes,
    )


def _dedupe_notes(notes: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for note in notes:
        if note in seen:
            continue
        ordered.append(note)
        seen.add(note)
    return ordered
