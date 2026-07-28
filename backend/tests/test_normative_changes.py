"""Pins the normative-language / gate-status surfacing gate (#2079).

Precedent: the quality-checks condensation flipped "MANDATORY on UI PRs"
to "recommended but not mandatory" and added an escape clause to a
PFLICHT gate - both invisible inside a 561-line deletion framed as
cleanup.

The tests build real throwaway git repos and run the checker as a
subprocess: it shells out to git itself, and a mocked diff would hide
exactly the pathspec bug that made an earlier version of this gate pass
by looking at the wrong files.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKER = REPO_ROOT / "scripts" / "verify_normative_changes.py"


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


def _run(root: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CHECKER), "--repo-root", str(root), "--base", "HEAD", *extra],
        capture_output=True,
        text=True,
        cwd=root,
    )


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A throwaway repo carrying the real rule surface at HEAD."""
    (tmp_path / ".claude" / "rules" / "lessons").mkdir(parents=True)
    (tmp_path / ".github" / "workflows").mkdir(parents=True)
    rules = REPO_ROOT / ".claude" / "rules"
    for name in ("gates.yaml", "checks.yaml"):
        shutil.copy2(rules / name, tmp_path / ".claude" / "rules" / name)
    for md in rules.glob("*.md"):
        shutil.copy2(md, tmp_path / ".claude" / "rules" / md.name)
    for wf in (REPO_ROOT / ".github" / "workflows").glob("*.yml"):
        (tmp_path / ".github" / "workflows" / wf.name).write_text("on: {}\n", encoding="utf-8")
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "config", "user.email", "t@example.com")
    _git(tmp_path, "config", "user.name", "test")
    _git(tmp_path, "add", "-A")
    _git(tmp_path, "commit", "-qm", "base")
    return tmp_path


def test_green_when_nothing_normative_changed(repo: Path) -> None:
    result = _run(repo)
    assert result.returncode == 0
    assert "no normative or gate-status changes" in result.stdout


def test_red_when_a_mandatory_rule_is_softened(repo: Path) -> None:
    """The actual incident: MANDATORY -> 'recommended but not mandatory'."""
    path = repo / ".claude" / "rules" / "quality-checks.md"
    text = path.read_text(encoding="utf-8")
    assert "## Feature Screenshots (MANDATORY on UI PRs)" in text
    path.write_text(
        text.replace(
            "## Feature Screenshots (MANDATORY on UI PRs)",
            "## Feature Screenshots (Recommended)",
        ),
        encoding="utf-8",
    )

    result = _run(repo)
    assert result.returncode == 2
    assert "normative language" in result.stdout
    assert "MANDATORY on UI PRs" in result.stdout
    assert "UNDECLARED" in result.stderr


def test_declaration_makes_it_pass(repo: Path) -> None:
    """Passable on purpose - via label or an explicit declaration line."""
    path = repo / ".claude" / "rules" / "quality-checks.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace("MANDATORY on UI PRs", "Recommended"),
        encoding="utf-8",
    )
    assert _run(repo).returncode == 2
    assert _run(repo, "--declared").returncode == 0
    body = "RULE-CHANGE DECLARED: screenshots become advisory, agreed in #1234"
    assert _run(repo, "--pr-body", body).returncode == 0


def test_red_when_a_gate_is_decoupled_into_no_rule(repo: Path) -> None:
    """Metadata weakening: the coverage check only forces a workflow to be
    classified, not correctly classified (#2075 gap)."""
    path = repo / ".claude" / "rules" / "gates.yaml"
    text = path.read_text(encoding="utf-8")
    # Drop the whole coupled block for that gate (fields may grow - body_sha
    # was added later - so match by boundaries, not by a literal blob).
    start = text.index("  - workflow: visual-baseline-gate.yml")
    end = text.index("  - workflow:", start + 10)
    text = text[:start] + text[end:]
    text = text.replace("no_rule:\n", "no_rule:\n  visual-baseline-gate.yml: no longer coupled\n")
    path.write_text(text, encoding="utf-8")

    result = _run(repo)
    assert result.returncode == 2
    assert "gate status" in result.stdout
    assert "decoupled" in result.stdout


def test_red_when_a_live_workflow_is_declared_retired(repo: Path) -> None:
    path = repo / ".claude" / "rules" / "gates.yaml"
    text = path.read_text(encoding="utf-8")
    path.write_text(
        text.replace("retired:\n", "retired:\n  testid-reference-gate.yml: pretend it is gone\n"),
        encoding="utf-8",
    )
    result = _run(repo)
    assert result.returncode == 2
    assert "still exists" in result.stdout


def test_yaml_only_keywords_do_not_fire(repo: Path) -> None:
    """Field documentation in checks.yaml is not rule prose - no false alarm."""
    path = repo / ".claude" / "rules" / "checks.yaml"
    path.write_text(
        path.read_text(encoding="utf-8") + "\n# note: reason is REQUIRED when disabled\n",
        encoding="utf-8",
    )
    assert _run(repo).returncode == 0
