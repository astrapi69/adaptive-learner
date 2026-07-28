"""Pins the bidirectional gate <-> rule coupling check (#2075).

The #1640 visual-baseline gate ran while its rule section was deleted -
enforcement without a documented rule. These tests are the RED proof that
the checker catches exactly that, plus the reverse direction (a rule
citing a workflow that no longer exists) and the coverage direction (a
new workflow nobody classified).

The checker is exercised as a SUBPROCESS against real throwaway trees,
not through mocks: it resolves paths itself, and a mocked filesystem
would hide exactly the resolution bugs that matter (see
lessons/core.md "Test a tool through the interface it actually uses").
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKER = REPO_ROOT / "scripts" / "verify_gate_rule_links.py"


def _run(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CHECKER), "--repo-root", str(root)],
        capture_output=True,
        text=True,
    )


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    """A faithful copy of the rule + workflow surface the checker reads."""
    (tmp_path / ".claude" / "rules" / "lessons").mkdir(parents=True)
    (tmp_path / ".github" / "workflows").mkdir(parents=True)
    rules = REPO_ROOT / ".claude" / "rules"
    shutil.copy2(rules / "gates.yaml", tmp_path / ".claude" / "rules" / "gates.yaml")
    for md in rules.glob("*.md"):
        shutil.copy2(md, tmp_path / ".claude" / "rules" / md.name)
    for md in (rules / "lessons").glob("*.md"):
        shutil.copy2(md, tmp_path / ".claude" / "rules" / "lessons" / md.name)
    for wf in (REPO_ROOT / ".github" / "workflows").glob("*.yml"):
        (tmp_path / ".github" / "workflows" / wf.name).write_text("on: {}\n", encoding="utf-8")
    return tmp_path


def test_green_on_the_real_repo() -> None:
    result = _run(REPO_ROOT)
    assert result.returncode == 0, result.stderr
    assert "gate<->rule links OK" in result.stdout


def test_faithful_copy_is_green(tree: Path) -> None:
    assert _run(tree).returncode == 0


def test_red_when_the_enforced_rule_section_is_deleted(tree: Path) -> None:
    """The exact #1640 incident: gate alive, rule section gone."""
    path = tree / ".claude" / "rules" / "quality-checks.md"
    text = path.read_text(encoding="utf-8")
    start = text.index("## Visual-Baseline duty for visually critical PRs (#1640)")
    end = text.index("## Mutation Testing")
    path.write_text(text[:start] + text[end:], encoding="utf-8")

    result = _run(tree)
    assert result.returncode == 1
    assert "visual-baseline-gate.yml" in result.stderr
    assert "visual-baseline-duty-for-visually-critical-prs-1640" in result.stderr


def test_red_when_a_rule_cites_a_removed_workflow(tree: Path) -> None:
    """Reverse direction: the rule text outlives the gate it names."""
    (tree / ".github" / "workflows" / "testid-reference-gate.yml").unlink()
    result = _run(tree)
    assert result.returncode == 1
    assert "testid-reference-gate.yml" in result.stderr


def test_red_when_a_new_workflow_is_unclassified(tree: Path) -> None:
    """A gate cannot slip in without being coupled or explicitly uncoupled."""
    (tree / ".github" / "workflows" / "brand-new-gate.yml").write_text("on: {}\n", encoding="utf-8")
    result = _run(tree)
    assert result.returncode == 1
    assert "brand-new-gate.yml" in result.stderr
    assert "neither gates: nor no_rule:" in result.stderr


def test_green_again_once_the_section_is_restored(tree: Path) -> None:
    """Guards against a checker that fails unconditionally."""
    path = tree / ".claude" / "rules" / "quality-checks.md"
    original = path.read_text(encoding="utf-8")
    start = original.index("## Visual-Baseline duty for visually critical PRs (#1640)")
    end = original.index("## Mutation Testing")
    path.write_text(original[:start] + original[end:], encoding="utf-8")
    assert _run(tree).returncode == 1
    path.write_text(original, encoding="utf-8")
    assert _run(tree).returncode == 0


class TestBodyHash:
    """#2079: existence is not content - a hollowed-out section must fail."""

    def test_red_when_the_body_is_hollowed_out_but_the_heading_stays(self, tree: Path) -> None:
        path = tree / ".claude" / "rules" / "quality-checks.md"
        text = path.read_text(encoding="utf-8")
        start = text.index("## Visual-Baseline duty for visually critical PRs (#1640)")
        end = text.index("## Mutation Testing")
        gutted = "## Visual-Baseline duty for visually critical PRs (#1640)\n\nSee the CI gate.\n\n"
        path.write_text(text[:start] + gutted + text[end:], encoding="utf-8")

        result = _run(tree)
        assert result.returncode == 1
        assert "the body of" in result.stderr
        assert "update body_sha" in result.stderr


class TestFailsClosed:
    """#2080 test contract, rule 3: a gate whose own basis is missing or
    unreadable must NEVER report green."""

    def test_missing_manifest_fails(self, tree: Path) -> None:
        (tree / ".claude" / "rules" / "gates.yaml").unlink()
        result = _run(tree)
        assert result.returncode == 1
        assert "missing manifest" in result.stderr

    def test_unreadable_manifest_fails(self, tree: Path) -> None:
        (tree / ".claude" / "rules" / "gates.yaml").write_text(
            "\x00\x00 not yaml", encoding="utf-8"
        )
        result = _run(tree)
        assert result.returncode == 1

    def test_missing_workflow_dir_fails(self, tree: Path) -> None:
        import shutil as _shutil

        _shutil.rmtree(tree / ".github" / "workflows")
        result = _run(tree)
        assert result.returncode == 1
