"""Cross-language parity for the lesson-XP rule (Phase 50A /
v1.33.0 / D-DEXIE-GAMIFICATION).

The Python implementation at
``adaptive_learner_gamification.xp_service`` and the TypeScript
port at ``frontend/src/lib/gamification/lesson-xp.ts`` MUST
produce byte-identical output for the same inputs. This test
pins the Python side; the matching TS test at
``frontend/src/lib/gamification/lesson-xp.parity.test.ts`` pins
the TS side. Both compare against the SAME golden files at
``tests/fixtures/lesson-xp-parity/expected/``.

Mirrors the 49F renderer parity pattern: shared JSON fixture +
per-case goldens + a regen env-var path. The single source of
truth is the GOLDEN MARKDOWN/JSON, not the implementation code.

Regenerate goldens with ``LESSON_XP_PARITY_REGEN=1 pytest
tests/test_xp_parity.py``.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from adaptive_learner_gamification.xp_service import (
    calculate_lesson_session_xp,
    compute_stars,
)

# Walk up: __file__ -> tests/ -> plugin pkg dir ->
# plugins/ -> repo root.
REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "lesson-xp-parity"
INPUT_PATH = FIXTURE_DIR / "input.json"
EXPECTED_DIR = FIXTURE_DIR / "expected"


def _load_fixture() -> dict:
    return json.loads(INPUT_PATH.read_text(encoding="utf-8"))


def _award_to_dict(award) -> dict:
    """Stable JSON shape for cross-language equality.

    Excludes ``xp_total``, ``level``, and ``level_up`` because
    those are populated by the persistence wrapper, not the pure
    calculator. ``breakdown`` keys are sorted for deterministic
    comparison; both Python (dict insertion order) and TS
    (Object key order) are stable today, but sorting removes
    that as a parity hazard.
    """
    return {
        "xp_earned": award.xp_earned,
        "multiplier": award.multiplier,
        "breakdown": dict(sorted(award.breakdown.items())),
        "reason": award.reason,
    }


def _write_golden(path: Path, payload: dict) -> None:
    """JSON serialization with the same shape on both sides.

    2-space indent + sorted keys + trailing newline. The TS side
    will mirror this with the same ``JSON.stringify`` settings.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8")


def test_compute_stars_matches_inline_expected():
    """compute_stars cases carry their expected stars inline.

    No per-case golden file — the expected value is a single
    integer, easier to read in input.json than in a separate
    file. The TS parity test will assert the same.
    """
    fixture = _load_fixture()
    for case in fixture["compute_stars_cases"]:
        actual = compute_stars(case["correct"], case["total"])
        expected = case["expected_stars"]
        assert actual == expected, (
            f"compute_stars drift in case '{case['name']}': "
            f"correct={case['correct']} total={case['total']} "
            f"-> Python returned {actual}, expected {expected}."
        )


def test_calculate_lesson_session_xp_matches_goldens():
    fixture = _load_fixture()
    regen = os.environ.get("LESSON_XP_PARITY_REGEN") == "1"

    for case in fixture["calculate_xp_cases"]:
        award = calculate_lesson_session_xp(
            stars=case["stars"],
            first_attempt=case["first_attempt"],
            streak_days=case["streak_days"],
        )
        payload = _award_to_dict(award)
        golden = EXPECTED_DIR / f"{case['name']}.json"

        if regen:
            _write_golden(golden, payload)
            continue

        assert golden.exists(), (
            f"Golden missing: {golden.relative_to(REPO_ROOT)}. "
            f"Set LESSON_XP_PARITY_REGEN=1 to (re)generate."
        )
        expected = json.loads(golden.read_text(encoding="utf-8"))
        assert payload == expected, (
            f"XP-award drift in case '{case['name']}'.\n"
            f"Expected (golden): {expected!r}\n"
            f"Got (Python):      {payload!r}"
        )

    if not regen:
        rendered_cases = {c["name"] for c in fixture["calculate_xp_cases"]}
        golden_cases = {p.stem for p in EXPECTED_DIR.glob("*.json")}
        assert golden_cases == rendered_cases, (
            f"Golden file set mismatch:\n"
            f"  only in goldens: {sorted(golden_cases - rendered_cases)}\n"
            f"  only in fixture: {sorted(rendered_cases - golden_cases)}"
        )
