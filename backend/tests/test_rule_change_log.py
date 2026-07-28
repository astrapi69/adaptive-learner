"""Pins the rule change log aggregator (#2087).

Four tests per the #2083 gate contract: it detects the violation (a
declaration missing from the log), it passes on a clean state, it fails
closed when its input cannot be read, and - the bug its own first run
exposed - a written entry is recognised again instead of being reported
as missing forever.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "append_rule_change_log.py"


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


def _run(root: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), *extra],
        capture_output=True,
        text=True,
        cwd=root,
    )


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A repo with one plain commit and one declaring commit."""
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "config", "user.email", "t@example.com")
    _git(tmp_path, "config", "user.name", "test")
    (tmp_path / "a.txt").write_text("one\n", encoding="utf-8")
    _git(tmp_path, "add", "-A")
    _git(tmp_path, "commit", "-qm", "chore: base")
    (tmp_path / "a.txt").write_text("two\n", encoding="utf-8")
    _git(tmp_path, "add", "-A")
    _git(
        tmp_path,
        "commit",
        "-qm",
        "docs(rules): tighten the backup gate (#4242)\n\n"
        "RULE-CHANGE DECLARED: the backup round-trip is mandatory again\n",
    )
    return tmp_path


def test_red_when_a_declaration_is_missing_from_the_log(repo: Path) -> None:
    result = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert result.returncode == 1
    assert "MISSING" in result.stderr
    assert "not in docs/rule-change-log.md" in result.stderr


def test_appending_then_checking_is_green(repo: Path) -> None:
    """The first-run bug: a written row must be recognised, not re-reported."""
    assert _run(repo, "--range", "HEAD~1..HEAD").returncode == 0
    log = (repo / "docs" / "rule-change-log.md").read_text(encoding="utf-8")
    assert "mandatory again" in log
    assert "#4242" in log

    second = _run(repo, "--range", "HEAD~1..HEAD", "--check")
    assert second.returncode == 0, second.stderr
    assert "up to date" in second.stdout


def test_green_when_nothing_was_declared(repo: Path) -> None:
    result = _run(repo, "--range", "HEAD~1..HEAD~1", "--check")
    assert result.returncode == 0


def test_fails_closed_on_an_unreadable_range(repo: Path) -> None:
    """A tool that cannot read its input may not report success (#2083)."""
    result = _run(repo, "--range", "no-such-ref..HEAD", "--check")
    assert result.returncode == 1
    assert "failed" in result.stderr
