"""Server-side parity for the frontend defensive-JSON-extractor.

These tests mirror ``frontend/src/lib/extract-json.test.ts``. Any
divergence in behaviour between the two parsers will produce
different analysis results in API mode vs Dexie mode, which is
precisely the bug the post-v1.5.0 backend-analyze route is meant
to avoid.
"""

from __future__ import annotations

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


def test_extract_json_object_pure_json():
    assert extract_json_object('{"a": 1, "b": 2}') == {"a": 1, "b": 2}


def test_extract_json_object_with_preamble():
    raw = 'Sure! Here is the analysis:\n{"topic": "Bayes"}\nLet me know!'
    assert extract_json_object(raw) == {"topic": "Bayes"}


def test_extract_json_object_with_fenced_json():
    raw = '```json\n{"topic": "Bayes"}\n```'
    assert extract_json_object(raw) == {"topic": "Bayes"}


def test_extract_json_object_with_prose_braces_picks_largest():
    """Regression for the original v1.0.1 bug — prose contains
    ``{placeholder}`` before the real JSON. The greedy regex would
    have grabbed from the first ``{`` to the last ``}``; the
    balanced scan picks the larger valid candidate."""
    raw = (
        "The user said {placeholder} before getting to the point. "
        'Result: {"topic": "Induction", "user_level": "beginner"}'
    )
    assert extract_json_object(raw) == {
        "topic": "Induction",
        "user_level": "beginner",
    }


def test_extract_json_object_with_nested_braces_in_string():
    """A brace inside a JSON string literal must NOT unbalance the
    depth counter."""
    raw = '{"summary": "User asked about {scope}", "topic": "x"}'
    assert extract_json_object(raw) == {
        "summary": "User asked about {scope}",
        "topic": "x",
    }


def test_extract_json_object_returns_none_on_garbage():
    assert extract_json_object("totally unparseable") is None


def test_extract_json_object_returns_none_on_empty():
    assert extract_json_object("") is None


def test_extract_json_object_unwraps_array_with_inner_object():
    """A top-level array isn't a dict, so ``json.loads`` succeeds
    but ``_try_parse`` rejects it. The balanced-brace scan then
    finds the inner ``{...}`` and returns it — matches the
    frontend's behaviour. The analysis prompt forbids array
    output, so this is a recovery path for misbehaving models,
    not the happy path."""
    assert extract_json_object('[{"a": 1}]') == {"a": 1}


def test_find_balanced_objects_picks_largest_first():
    raw = '{"small": 1} ... {"large": [1, 2, 3, 4, 5]}'
    objects = find_balanced_objects(raw)
    assert objects[0] == '{"large": [1, 2, 3, 4, 5]}'
    assert objects[1] == '{"small": 1}'
