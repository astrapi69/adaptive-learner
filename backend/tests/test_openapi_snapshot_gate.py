"""Gate-contract tests for the OpenAPI snapshot gate (#2281, #2083).

The five-point contract from quality-checks.md "Gate test contract":
detects the violation, passes clean, fails closed, reports what it
measured, and the number means the same thing everywhere (plugin-set
assertion + version normalisation).

The script is exercised through its real interface - a subprocess, the
way ``make sync-openapi-check`` runs it (lessons/core.md "Test a tool
through the interface it actually uses, not a mock of it"). The two
app-booting runs are shared through a module-scoped fixture to keep the
suite cost at two boots; the fail-closed cases exercise the pre-boot
snapshot read and stay cheap.
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
SCRIPT = REPO_ROOT / "scripts" / "sync_openapi.py"
VERSION_SENTINEL = "0.0.0-snapshot"


def _run(*argv: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *argv],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT / "backend",
    )


@pytest.fixture(scope="module")
def generated_snapshot(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """One real generation run, shared by every test in this module."""
    snapshot = tmp_path_factory.mktemp("openapi-gate") / "openapi.json"
    result = _run("--snapshot", str(snapshot))
    assert result.returncode == 0, result.stdout + result.stderr
    assert snapshot.is_file()
    return snapshot


def test_clean_check_passes_and_reports_what_it_measured(generated_snapshot: Path) -> None:
    """Contract points 2 + 4: green on a clean tree, and the output names
    the measured set so '0 differences' and '0 operations inspected'
    can never look alike."""
    result = _run("--check", "--snapshot", str(generated_snapshot))
    assert result.returncode == 0, result.stdout + result.stderr
    assert "check OK" in result.stdout
    measured = next(
        line for line in result.stdout.splitlines() if line.startswith("openapi-snapshot: plugins")
    )
    n_active, n_disk = measured.split("plugins ")[1].split(",")[0].split("/")
    assert n_active == n_disk, f"plugin set incomplete in test env: {measured}"
    for label in ("paths", "operations", "schemas"):
        count = int(measured.split(f"{label} ")[1].split(",")[0])
        assert count > 0, f"measured 0 {label}: {measured}"


def test_check_detects_a_removed_path(generated_snapshot: Path, tmp_path: Path) -> None:
    """Contract point 1: dropping a route from the snapshot goes RED and
    the drift summary names it."""
    mutated = json.loads(generated_snapshot.read_text(encoding="utf-8"))
    removed_path = sorted(mutated["paths"])[0]
    del mutated["paths"][removed_path]
    mutated_file = tmp_path / "openapi.json"
    mutated_file.write_text(json.dumps(mutated, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    result = _run("--check", "--snapshot", str(mutated_file))
    assert result.returncode == 1, result.stdout + result.stderr
    assert "DRIFT" in result.stdout
    assert removed_path in result.stdout


def test_missing_snapshot_fails_closed(tmp_path: Path) -> None:
    """Contract point 3: no snapshot is RED, never 'nothing to compare'."""
    result = _run("--check", "--snapshot", str(tmp_path / "does-not-exist.json"))
    assert result.returncode == 2, result.stdout + result.stderr
    assert "FAIL-CLOSED" in result.stdout
    assert "snapshot missing" in result.stdout


def test_corrupt_snapshot_fails_closed(tmp_path: Path) -> None:
    """Contract point 3: an unreadable snapshot is RED."""
    corrupt = tmp_path / "openapi.json"
    corrupt.write_text("{ this is not json", encoding="utf-8")
    result = _run("--check", "--snapshot", str(corrupt))
    assert result.returncode == 2, result.stdout + result.stderr
    assert "FAIL-CLOSED" in result.stdout
    assert "unreadable" in result.stdout


def test_snapshot_version_is_normalised(generated_snapshot: Path) -> None:
    """Contract point 5: ``info.version`` changes every release and is
    pinned by test_openapi_version_matches instead - the snapshot carries
    a sentinel so version bumps cannot churn or fail the gate."""
    spec = json.loads(generated_snapshot.read_text(encoding="utf-8"))
    assert spec["info"]["version"] == VERSION_SENTINEL
