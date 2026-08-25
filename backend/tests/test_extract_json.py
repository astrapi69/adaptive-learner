"""Server-side parity for the frontend defensive-JSON-extractor.

These tests mirror ``frontend/src/lib/extract-json.test.ts``. Any
divergence in behaviour between the two parsers will produce
different analysis results in API mode vs Dexie mode, which is
precisely the bug the post-v1.5.0 backend-analyze route is meant
to avoid.
"""

from __future__ import annotations

import pytest

from app.services.extract_json import (
    extract_json_object,
    find_balanced_objects,
    strip_fences,
)


def test_strip_fences_removes_json_fence():
    """``\\s*`` after the opening fence consumes the trailing newline
    — matches the frontend extract-json.ts behaviour exactly."""
    assert strip_fences('```json\n{"a": 1}\n```') == '{"a": 1}\n'


def test_strip_fences_removes_plain_fence():
    assert strip_fences('```\n{"a": 1}\n```') == '{"a": 1}\n'


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param('{"a": 1, "b": 2}', {"a": 1, "b": 2}, id="pure_json"),
        pytest.param(
            'Sure! Here is the analysis:\n{"topic": "Bayes"}\nLet me know!',
            {"topic": "Bayes"},
            id="with_preamble",
        ),
        pytest.param(
            '```json\n{"topic": "Bayes"}\n```',
            {"topic": "Bayes"},
            id="with_fenced_json",
        ),
        # Regression for the original v1.0.1 bug — prose contains
        # ``{placeholder}`` before the real JSON. The greedy regex would
        # have grabbed from the first ``{`` to the last ``}``; the
        # balanced scan picks the larger valid candidate.
        pytest.param(
            "The user said {placeholder} before getting to the point. "
            'Result: {"topic": "Induction", "user_level": "beginner"}',
            {"topic": "Induction", "user_level": "beginner"},
            id="prose_braces_picks_largest",
        ),
        # A brace inside a JSON string literal must NOT unbalance the
        # depth counter.
        pytest.param(
            '{"summary": "User asked about {scope}", "topic": "x"}',
            {"summary": "User asked about {scope}", "topic": "x"},
            id="nested_braces_in_string",
        ),
        pytest.param("totally unparseable", None, id="none_on_garbage"),
        pytest.param("", None, id="none_on_empty"),
        # A top-level array isn't a dict, so ``json.loads`` succeeds but
        # ``_try_parse`` rejects it. The balanced-brace scan then finds the
        # inner ``{...}`` and returns it — matches the frontend's behaviour.
        # The analysis prompt forbids array output, so this is a recovery
        # path for misbehaving models, not the happy path.
        pytest.param('[{"a": 1}]', {"a": 1}, id="unwraps_array_with_inner_object"),
    ],
)
def test_extract_json_object(raw: str, expected: dict | None) -> None:
    """One value table over the extractor's whole input space
    (quality-checks.md "Parametrized tests", #2744): every case is
    exactly ``extract_json_object(raw) == expected`` — the speaking
    ids carry the former per-function names."""
    assert extract_json_object(raw) == expected


def test_find_balanced_objects_picks_largest_first():
    raw = '{"small": 1} ... {"large": [1, 2, 3, 4, 5]}'
    objects = find_balanced_objects(raw)
    assert objects[0] == '{"large": [1, 2, 3, 4, 5]}'
    assert objects[1] == '{"small": 1}'
