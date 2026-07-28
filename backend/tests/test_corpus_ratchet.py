"""Pins the rule-corpus ratchet (#2091).

The corpus is injected into every prompt of every session, so its size is
a cost paid on every turn. Every single addition is justifiable; nothing
measured the sum. This gate puts a ceiling on it.

Four tests per the #2083 contract: it detects the violation (growth past
the ceiling), it passes on a clean tree, it fails closed when its basis
is missing or the measured set is empty, and it PROVES what it measured -
a ratchet that finds no files would otherwise report "0 <= ceiling" and
pass, which is the fail-open class of #2079 and #2083.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "verify_rule_corpus_size.py"
BASELINE = Path(".claude/rules/.corpus-baseline.json")


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    """A writable copy of the measured surface plus the scripts."""
    for name in (".claude", "scripts", "CLAUDE.md"):
        source = REPO_ROOT / name
        target = tmp_path / name
        if source.is_dir():
            shutil.copytree(source, target, symlinks=True)
        else:
            shutil.copy2(source, target)
    return tmp_path


def _run(root: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), *extra],
        capture_output=True,
        text=True,
        cwd=root,
    )


def test_green_on_the_current_corpus(tree: Path) -> None:
    result = _run(tree)
    assert result.returncode == 0, result.stderr


def test_red_when_the_corpus_grows_past_the_ceiling(tree: Path) -> None:
    """The RED proof: an added rule file that overshoots must fail the gate."""
    (tree / ".claude" / "rules" / "bloat.md").write_text("x" * 50_000, encoding="utf-8")
    result = _run(tree)
    assert result.returncode == 1
    assert "over the ceiling" in result.stderr


def test_reports_the_measured_set(tree: Path) -> None:
    """A ratchet that measured nothing must not be mistaken for a green one."""
    result = _run(tree)
    baseline = json.loads((tree / BASELINE).read_text(encoding="utf-8"))
    assert f"{baseline['file_count']} files" in result.stdout
    assert "CLAUDE.md" in result.stdout


def test_fails_closed_without_its_baseline(tree: Path) -> None:
    (tree / BASELINE).unlink()
    result = _run(tree)
    assert result.returncode == 1
    assert "missing baseline" in result.stderr


def test_fails_closed_when_the_measured_set_is_empty(tree: Path) -> None:
    """The #2079 pathspec class: discovery that finds nothing may not pass."""
    shutil.rmtree(tree / ".claude" / "rules")
    result = _run(tree)
    assert result.returncode == 1
    assert "measured nothing" in result.stderr


def test_shrinking_lowers_the_ceiling_only_on_request(tree: Path) -> None:
    """A ratchet only ever tightens - and never silently."""
    before = json.loads((tree / BASELINE).read_text(encoding="utf-8"))["total_chars"]
    (tree / ".claude" / "rules" / "reusability.md").write_text("small\n", encoding="utf-8")

    assert _run(tree).returncode == 0
    unchanged = json.loads((tree / BASELINE).read_text(encoding="utf-8"))["total_chars"]
    assert unchanged == before

    assert _run(tree, "--update-baseline").returncode == 0
    after = json.loads((tree / BASELINE).read_text(encoding="utf-8"))["total_chars"]
    assert after < before


def test_raising_the_ceiling_needs_an_explicit_flag(tree: Path) -> None:
    """Growth stays possible - as a deliberate act, visible in the diff."""
    (tree / ".claude" / "rules" / "bloat.md").write_text("x" * 50_000, encoding="utf-8")

    refused = _run(tree, "--update-baseline")
    assert refused.returncode == 1
    assert "--allow-raise" in refused.stderr

    assert _run(tree, "--update-baseline", "--allow-raise").returncode == 0
    assert _run(tree).returncode == 0
