"""Cross-language parity tests for the lesson splitter (Phase 63G).

TypeScript mirror: ``frontend/src/lib/content/lesson-splitter.parity.test.ts``

Both files read the same fixtures at
``tests/fixtures/lesson-splitter-parity/`` and assert against the
same goldens. The Python side is the canonical golden generator:

    LESSON_SPLITTER_PARITY_REGEN=1 pytest tests/test_lesson_splitter.py

In normal CI the env-var is absent, so the test asserts but never
writes.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest

from adaptive_learner_content_loader.lesson_splitter import split_lesson
from adaptive_learner_content_loader.schema import Lesson

# Resolve repo root (three levels up from this test file):
# tests/ -> plugin-package/ -> plugins/ -> repo-root
REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "lesson-splitter-parity"
EXPECTED_DIR = FIXTURE_DIR / "expected"
INPUT_PATH = FIXTURE_DIR / "input.json"

_REGEN = os.getenv("LESSON_SPLITTER_PARITY_REGEN") == "1"


def _load_input() -> Lesson:
    return Lesson(**json.loads(INPUT_PATH.read_text()))


def _summarize(lesson: Lesson, max_steps: int) -> list[dict[str, Any]]:
    parts = split_lesson(lesson, max_steps_per_part=max_steps)
    return [
        {
            "id": p.id,
            "title": p.title,
            "estimated_minutes": p.estimated_minutes,
            "step_ids": [s.id for s in p.steps],
            "card_ids": [c.id for c in p.cards],
        }
        for p in parts
    ]


def _golden_path(name: str) -> Path:
    return EXPECTED_DIR / f"{name}.json"


def _load_golden(name: str) -> Any:
    return json.loads(_golden_path(name).read_text())


def _maybe_regen(name: str, actual: Any) -> None:
    if _REGEN:
        EXPECTED_DIR.mkdir(parents=True, exist_ok=True)
        _golden_path(name).write_text(
            json.dumps(actual, indent=2, ensure_ascii=False) + "\n"
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name,max_steps",
    [
        ("split3", 3),
        ("split4", 4),
        ("no_split", 10),
    ],
)
def test_split_parity(name: str, max_steps: int) -> None:
    """Split result matches the golden fixture byte-for-byte."""
    lesson = _load_input()
    actual = _summarize(lesson, max_steps)
    _maybe_regen(name, actual)
    expected = _load_golden(name)
    assert actual == expected, (
        f"Lesson-splitter parity failed for '{name}'. "
        f"Regenerate goldens with LESSON_SPLITTER_PARITY_REGEN=1 "
        f"if the Python source changed intentionally, then update the TS port."
    )


def test_no_split_returns_same_object() -> None:
    """When len(steps) <= max_steps, the SAME Lesson object is returned."""
    lesson = _load_input()
    result = split_lesson(lesson, max_steps_per_part=100)
    assert len(result) == 1
    assert result[0] is lesson


def test_invalid_max_steps() -> None:
    lesson = _load_input()
    with pytest.raises(ValueError, match="max_steps_per_part must be >= 1"):
        split_lesson(lesson, max_steps_per_part=0)
