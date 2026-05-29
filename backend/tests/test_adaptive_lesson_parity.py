"""Cross-language parity for the adaptive-lesson error analyzer
(Phase 53A / v1.36.0 / EXP-013 / Q-114).

Pins the Python implementation at
``backend/app/services/adaptive_lesson.py`` against the same
JSON goldens the TypeScript test at
``frontend/src/lib/adaptive/error-analyzer.parity.test.ts`` reads.

Regenerate goldens (Python is canonical):
    ADAPTIVE_LESSON_PARITY_REGEN=1 poetry run pytest \
        backend/tests/test_adaptive_lesson_parity.py

If this test fails after intentional algorithm changes:
    1. Run the regen command above
    2. Commit the updated goldens
    3. Run the matching TS test — if red, port the algorithm change
       to ``frontend/src/lib/adaptive/error-analyzer.ts``
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

import pytest

from app.services.adaptive_lesson import (
    ElementErrorInput,
    analysis_to_dict,
    analyze_errors,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "adaptive-lesson-parity"
INPUT_PATH = FIXTURE_DIR / "input.json"
EXPECTED_DIR = FIXTURE_DIR / "expected"


def _load_fixture() -> dict:
    return json.loads(INPUT_PATH.read_text(encoding="utf-8"))


def _write_golden(path: Path, payload: dict) -> None:
    """JSON serialization matching the TS side: 2-space indent +
    sorted keys + trailing newline. ``JSON.stringify(obj, null, 2)``
    on the TS side after the same key-sort pre-step yields the
    same bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8")


def _read_golden(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _to_input(error_dict: dict) -> ElementErrorInput:
    return ElementErrorInput(
        element_key=error_dict["element_key"],
        set_id=error_dict["set_id"],
        lesson_id=error_dict["lesson_id"],
        exercise_id=error_dict["exercise_id"],
        element_type=error_dict["element_type"],
        user_answer=error_dict["user_answer"],
        correct_answer=error_dict["correct_answer"],
        error_count=error_dict["error_count"],
        correct_streak=error_dict["correct_streak"],
        last_error_at=error_dict["last_error_at"],
        last_attempt_at=error_dict["last_attempt_at"],
        mastered=error_dict["mastered"],
    )


def _all_cases():
    fixture = _load_fixture()
    return [(case["name"], case["errors"], fixture["now"], fixture["focus_count"]) for case in fixture["cases"]]


@pytest.mark.parametrize("case_name,errors,now_iso,focus_count", _all_cases())
def test_analyze_errors_matches_golden(
    case_name: str,
    errors: list[dict],
    now_iso: str,
    focus_count: int,
) -> None:
    """For each case in input.json, run the analyzer and assert
    byte-for-byte equality with the matching golden file. When
    ``ADAPTIVE_LESSON_PARITY_REGEN=1`` is set, regenerate the
    golden instead of asserting — used after intentional
    algorithm changes."""
    inputs = [_to_input(e) for e in errors]
    now = datetime.fromisoformat(now_iso)
    analysis = analyze_errors(inputs, now=now, focus_count=focus_count)
    actual = analysis_to_dict(analysis)
    golden_path = EXPECTED_DIR / f"{case_name}.json"
    if os.environ.get("ADAPTIVE_LESSON_PARITY_REGEN") == "1":
        _write_golden(golden_path, actual)
        pytest.skip(f"Regenerated golden for {case_name}")
    assert golden_path.exists(), (
        f"Missing golden for {case_name}. Run "
        f"ADAPTIVE_LESSON_PARITY_REGEN=1 pytest to create."
    )
    expected = _read_golden(golden_path)
    assert actual == expected, (
        f"Parity mismatch for {case_name}.\n"
        f"Expected:\n{json.dumps(expected, indent=2, sort_keys=True)}\n"
        f"Actual:\n{json.dumps(actual, indent=2, sort_keys=True)}"
    )
