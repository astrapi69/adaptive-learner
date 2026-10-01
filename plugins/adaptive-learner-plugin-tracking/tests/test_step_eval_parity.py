"""Cross-language parity for the step-evaluation insights (#3394).

``aggregate_step_evaluations`` (this plugin) and the TypeScript port at
``frontend/src/storage/services/step-evaluation-summary.ts`` must produce the
same slice for the same rows. Both assert against
``tests/fixtures/step-eval-parity/expected.json``; Python is the canonical
regenerator (``STEP_EVAL_PARITY_REGEN=1 pytest tests/test_step_eval_parity.py``).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from adaptive_learner_tracking.summary import aggregate_step_evaluations

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "step-eval-parity"


def _actual() -> dict[str, dict]:
    cases = json.loads((FIXTURE_DIR / "input.json").read_text(encoding="utf-8"))["cases"]
    # JSON object keys are strings on both sides.
    return {
        case["name"]: json.loads(json.dumps(aggregate_step_evaluations(case["rows"])))
        for case in cases
    }


def test_step_eval_aggregate_matches_the_goldens() -> None:
    expected_path = FIXTURE_DIR / "expected.json"
    actual = _actual()
    if os.environ.get("STEP_EVAL_PARITY_REGEN") == "1":
        expected_path.write_text(json.dumps(actual, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    assert len(actual) >= 4
    assert json.loads(expected_path.read_text(encoding="utf-8")) == actual
