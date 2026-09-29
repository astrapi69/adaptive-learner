"""The theme token gate runs on every frontend change in CI (#3251).

``scripts/verify_theme.py`` ran only inside a backend test and in
``make release-test``, so a CSS-only PR never tripped it (#3241 inventory).
Pins the fixed frontend-tests step: present, enforcing, and not gated on
the backend filter.
"""

from __future__ import annotations

from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]


def _frontend_steps() -> list[dict]:
    workflow = yaml.safe_load(
        (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    )
    return workflow["jobs"]["frontend-tests"]["steps"]


def test_the_theme_token_gate_is_a_fixed_frontend_step() -> None:
    steps = [step for step in _frontend_steps() if step.get("name") == "Theme token gate (#3251)"]
    assert len(steps) == 1, "the theme token gate step is missing or duplicated"
    step = steps[0]
    assert "scripts/verify_theme.py --enforce" in step["run"]
    assert "needs.changes.outputs.frontend == 'true'" in step["if"]
    assert "needs.changes.outputs.backend" not in step["if"]
    assert "github.event_name != 'pull_request'" in step["if"], "must also run on the develop push"
