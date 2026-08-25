"""Gate-contract tests for scripts/check_dead_code.py (#2741).

The five-point contract (quality-checks.md "Gate test contract"): the
gate detects a violation, passes clean, fails CLOSED on a broken basis,
reports WHAT it scanned, and a partial run is an explicit named opt-in.

Tested through the REAL interface (subprocess against the actual repo
scope, lessons/core.md "Test a tool through the interface it actually
uses"): the python side runs the real vulture over the real packages
(~seconds); the knip side is exercised only through the explicit
``--only python`` partial marker (a full knip run needs the frontend
toolchain and belongs to the workflow, not the unit gate).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(
    subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
)
SCRIPT = REPO_ROOT / "scripts" / "check_dead_code.py"
REAL_BASELINE = REPO_ROOT / ".dead-code-baseline.json"


def run_gate(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=600,
    )


@pytest.fixture(scope="module")
def python_findings() -> list[str]:
    """The real current python findings, via a scratch baseline seed."""
    raw = json.loads(REAL_BASELINE.read_text())
    return list(raw["python"])


def _write_baseline(path: Path, python: list[str]) -> None:
    raw = json.loads(REAL_BASELINE.read_text())
    payload = {"note": "test", "python": python, "typescript": raw["typescript"]}
    path.write_text(json.dumps(payload))


def test_detects_a_new_finding_and_names_it(tmp_path: Path, python_findings: list[str]) -> None:
    """Contract point 1: removing one KNOWN entry from the baseline makes
    the still-present real finding read as NEW and fail the run by name."""
    assert python_findings, "the seeded baseline must carry a python tail"
    victim = python_findings[0]
    baseline = tmp_path / "baseline.json"
    _write_baseline(baseline, python_findings[1:])
    proc = run_gate("--only", "python", "--baseline", str(baseline))
    assert proc.returncode == 1
    assert "NEW finding" in proc.stdout
    assert victim in proc.stdout


def test_passes_on_a_clean_tree_against_the_full_baseline() -> None:
    proc = run_gate("--only", "python", "--baseline", str(REAL_BASELINE))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "no new findings" in proc.stdout


def test_fails_closed_when_the_baseline_is_missing(tmp_path: Path) -> None:
    proc = run_gate("--only", "python", "--baseline", str(tmp_path / "gone.json"))
    assert proc.returncode == 1
    assert "no readable baseline" in proc.stderr


def test_fails_closed_when_the_baseline_is_corrupt(tmp_path: Path) -> None:
    broken = tmp_path / "broken.json"
    broken.write_text("{not json")
    proc = run_gate("--only", "python", "--baseline", str(broken))
    assert proc.returncode == 1
    assert "failing closed" in proc.stderr or "no readable baseline" in proc.stderr


def test_reports_what_it_scanned_and_marks_the_partial_run() -> None:
    """Contract points 4 + 5-adjacent: the scanned scope size is printed,
    and a partial run announces itself instead of passing by silence."""
    proc = run_gate("--only", "python", "--baseline", str(REAL_BASELINE))
    assert "package roots" in proc.stdout
    assert "PARTIAL run by explicit --only python" in proc.stdout


def test_resolved_entries_are_reported_but_never_auto_banked(
    tmp_path: Path, python_findings: list[str]
) -> None:
    """A baseline entry the scan no longer yields is offered for manual
    banking, and the baseline FILE stays untouched (#2140)."""
    baseline = tmp_path / "baseline.json"
    ghost = "backend/app/never_existed.py::ghost_helper::function"
    _write_baseline(baseline, [*python_findings, ghost])
    before = baseline.read_text()
    proc = run_gate("--only", "python", "--baseline", str(baseline))
    assert proc.returncode == 0
    assert "no longer found" in proc.stdout
    assert ghost in proc.stdout
    assert baseline.read_text() == before
