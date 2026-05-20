"""Defensive JSON extraction (server-side mirror of ``frontend/src/lib/extract-json.ts``).

The greedy ``\\{.*\\}`` regex used by the early-Phase-12 analysis parser
breaks on AI responses that contain ``{`` or ``}`` characters in
surrounding prose (e.g. claude-3-5-haiku saying "the user struggled
with {placeholder} concepts" before the actual JSON). The greedy
match grabs from the first ``{`` in the prose to the last ``}``
in the JSON, swallowing the intervening text and crashing
``json.loads``.

This helper replaces the regex with a stack-based balanced-brace
scan that is also string- and escape-aware. Algorithm:

  1. Strip the input, drop any ```json``` / ``` ``` fences from
     anywhere in the string.
  2. Try ``json.loads`` on the whole thing (best case).
  3. If that fails, scan for every ``{`` and find its matching
     ``}`` with proper string-awareness (so braces inside a JSON
     string don't unbalance the scan).
  4. Try each candidate in decreasing-length order — the largest
     balanced object that parses is the answer (the actual
     analysis output is usually larger than any prose braces).

Returns ``None`` on any structural failure. Caller decides what
to do with that (fallback, retry, etc.).
"""

from __future__ import annotations

import json
import re
from typing import Any

_FENCE_PATTERN = re.compile(r"```(?:json|JSON)?\s*")
_PLAIN_FENCE = re.compile(r"```")


def strip_fences(text: str) -> str:
    """Strip ``` fences anywhere in the string (not just at start /
    end). Handles both ``` and ```json variants."""
    return _PLAIN_FENCE.sub("", _FENCE_PATTERN.sub("", text))


def find_balanced_objects(text: str) -> list[str]:
    """Walk the input and emit every balanced ``{...}`` substring.

    String literals and escape sequences are respected so that a
    brace inside a quoted string doesn't unbalance the depth
    counter.

    The result is sorted by length DESCENDING — the assumption is
    that the largest balanced block is the actual JSON we want,
    not a prose ``{like this}`` mention.
    """
    results: list[str] = []
    length = len(text)
    for i in range(length):
        if text[i] != "{":
            continue
        depth = 0
        in_string = False
        escape = False
        j = i
        while j < length:
            ch = text[j]
            if escape:
                escape = False
                j += 1
                continue
            if ch == "\\":
                escape = True
                j += 1
                continue
            if ch == '"':
                in_string = not in_string
                j += 1
                continue
            if in_string:
                j += 1
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    results.append(text[i : j + 1])
                    break
            j += 1
    results.sort(key=len, reverse=True)
    return results


def _try_parse(candidate: str) -> dict[str, Any] | None:
    try:
        data = json.loads(candidate)
    except (json.JSONDecodeError, ValueError):
        return None
    if isinstance(data, dict):
        return data
    return None


def extract_json_object(raw: str) -> dict[str, Any] | None:
    """Try to extract one JSON object from a (possibly prose-wrapped)
    AI response. Returns the parsed object or ``None`` on any
    structural failure.

    Accepts:
      - Pure JSON                            ``{...}``
      - Fenced JSON                          ``\\`\\`\\`json\\n{...}\\n\\`\\`\\```
      - Prose-wrapped JSON                   ``Here is the analysis: {...} Let me know!``
      - Prose containing other braces        ``The user said {placeholder}. Result: {...}``
      - Multiple JSON objects                (picks the largest)
    """
    if not isinstance(raw, str) or not raw.strip():
        return None
    stripped = strip_fences(raw.strip())
    direct = _try_parse(stripped)
    if direct is not None:
        return direct
    for candidate in find_balanced_objects(stripped):
        parsed = _try_parse(candidate)
        if parsed is not None:
            return parsed
    return None


__all__ = [
    "extract_json_object",
    "find_balanced_objects",
    "strip_fences",
]
