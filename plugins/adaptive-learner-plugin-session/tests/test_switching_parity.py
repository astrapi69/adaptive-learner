"""Cross-language parity for the method-switch rule (#3396).

``switching.recommend`` and the TypeScript port at
``frontend/src/lib/adaptive/method-switch.ts`` must give the same answer for
the same ratings. Both assert against
``tests/fixtures/method-switch-parity/expected.json``; Python regenerates it
(``METHOD_SWITCH_PARITY_REGEN=1 pytest tests/test_switching_parity.py``).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from adaptive_learner_session.switching import recommend

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "method-switch-parity"


def _actual() -> dict[str, object]:
    cases = json.loads((FIXTURE_DIR / "input.json").read_text(encoding="utf-8"))["cases"]
    return {
        case["name"]: recommend(
            "p1",
            case["current_method"],
            case["recent_ratings"],
            profile=case.get("profile"),
            recently_used_methods=case.get("recently_used_methods"),
        )
        for case in cases
    }


def test_switch_rule_matches_the_goldens() -> None:
    expected_path = FIXTURE_DIR / "expected.json"
    actual = _actual()
    if os.environ.get("METHOD_SWITCH_PARITY_REGEN") == "1":
        expected_path.write_text(
            json.dumps(actual, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    assert len(actual) >= 8
    assert json.loads(expected_path.read_text(encoding="utf-8")) == actual
