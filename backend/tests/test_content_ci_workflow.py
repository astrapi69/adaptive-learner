"""Pins the content-repo CI mirror (Phase 60 / v1.44.0, D-108).

The validation workflow + validator for the separate
``astrapi69/adaptive-learner-content`` repo live under
``docs/ci/adaptive-learner-content/``. These tests assert the
workflow YAML parses and is wired correctly, and that the
validator script is syntactically valid Python — so the mirror
can't rot into something that wouldn't run in the content repo's
CI.
"""

from __future__ import annotations

import py_compile
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CI_DIR = REPO_ROOT / "docs" / "ci" / "adaptive-learner-content"
WORKFLOW = CI_DIR / ".github" / "workflows" / "validate-content.yml"
VALIDATOR = CI_DIR / "scripts" / "validate_content.py"


def test_workflow_yaml_parses_and_is_wired() -> None:
    assert WORKFLOW.is_file(), f"missing {WORKFLOW}"
    doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    # ``on:`` parses to the boolean True key in YAML 1.1 — accept either.
    triggers = doc.get("on", doc.get(True))
    assert triggers is not None, "workflow has no triggers"
    assert "pull_request" in triggers, "workflow must run on pull_request"
    job = doc["jobs"]["validate"]
    runs = " ".join(
        step.get("run", "") for step in job["steps"] if isinstance(step, dict)
    )
    assert "validate_content.py" in runs, "workflow must run the validator"


def test_validator_script_is_valid_python() -> None:
    assert VALIDATOR.is_file(), f"missing {VALIDATOR}"
    # Raises py_compile.PyCompileError on a syntax error.
    py_compile.compile(str(VALIDATOR), doraise=True)
