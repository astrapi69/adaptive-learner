"""Gate test contract, rule 3: fail CLOSED when the basis is missing (#2083).

Two fail-open findings in quick succession while building the
rule-integrity gates - the ``no_warn`` probe that passed when
``verify_docs`` could not run (#2077), and the pathspec bug that made the
language gate look at almost no files (#2079) - plus a third found by the
retrospective this test file belongs to: the complexity ratchet reported
"Complexity gate passed" when radon was unavailable or its baseline was
gone, because "no analyzer" silently read as "no offenders".

Every gate gets the same three tests: it detects the violation, it passes
on a clean tree, and it refuses to report success when its own basis is
absent or broken. This file holds the third for the gates whose basis is
a file or an external analyzer.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from tests.repo_mirror import mirror_repo

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    """A mirror of the repo: symlinks, with the mutable surfaces copied
    (#3036: ``.claude/rules`` only, never the agent worktrees beside it)."""
    return mirror_repo(tmp_path, mutable=("scripts", "Makefile", ".complexity-baseline")).root


def _run(
    root: Path, *cmd: str, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    full_env = {**os.environ, **(env or {})}
    return subprocess.run(list(cmd), cwd=root, capture_output=True, text=True, env=full_env)


def test_lessons_inventory_fails_without_its_baseline(tree: Path) -> None:
    baseline = tree / ".claude" / "rules" / "lessons" / ".inventory-baseline.json"
    baseline.unlink()
    result = _run(
        tree,
        sys.executable,
        "scripts/verify_lessons_inventory.py",
        "--compare",
        str(baseline),
    )
    assert result.returncode != 0


def test_check_inventory_fails_without_its_inventory(tree: Path) -> None:
    (tree / ".claude" / "rules" / "checks.yaml").unlink()
    result = _run(
        tree, sys.executable, "scripts/verify_check_inventory.py", "--repo-root", str(tree)
    )
    assert result.returncode == 1
    assert "missing inventory" in result.stderr


def test_gate_rule_links_fails_without_its_manifest(tree: Path) -> None:
    (tree / ".claude" / "rules" / "gates.yaml").unlink()
    result = _run(
        tree, sys.executable, "scripts/verify_gate_rule_links.py", "--repo-root", str(tree)
    )
    assert result.returncode == 1
    assert "missing manifest" in result.stderr


def test_complexity_gate_fails_without_its_baseline(tree: Path) -> None:
    """A ratchet without its baseline cannot ratchet - it must not pass."""
    baseline = tree / ".complexity-baseline"
    if baseline.exists():
        baseline.unlink()
    result = _run(tree, "bash", "scripts/check-complexity.sh", "--gate")
    assert result.returncode == 1
    assert "baseline" in result.stderr.lower()


def test_complexity_gate_fails_when_the_analyzer_is_broken(tree: Path, tmp_path: Path) -> None:
    """'No analyzer' must never read as 'no offenders' (the retrospective finding)."""
    shim = tmp_path / "shim"
    shim.mkdir()
    (shim / "radon").write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
    (shim / "radon").chmod(0o755)

    result = _run(
        tree,
        "bash",
        "scripts/check-complexity.sh",
        "--gate",
        env={"PATH": f"{shim}:{os.environ['PATH']}"},
    )
    assert result.returncode == 1
    assert "cannot verify" in result.stderr


def test_complexity_gate_partial_run_stays_possible_but_declared(
    tree: Path, tmp_path: Path
) -> None:
    """Deliberate partial runs remain possible - via an explicit opt-in."""
    shim = tmp_path / "shim2"
    shim.mkdir()
    (shim / "radon").write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
    (shim / "radon").chmod(0o755)

    result = _run(
        tree,
        "bash",
        "scripts/check-complexity.sh",
        "--gate",
        env={
            "PATH": f"{shim}:{os.environ['PATH']}",
            "COMPLEXITY_GATE_ALLOW_PARTIAL": "1",
        },
    )
    assert result.returncode == 0


def test_complexity_gate_refuses_a_mismatched_radon_version(tree: Path, tmp_path: Path) -> None:
    """Decision #2138: the gate measures with the pinned radon or not at all.

    A version-dependent oracle drifts both ways; the dangerous direction is
    the silent one downward. A radon that answers with a foreign version must
    not produce the gate's reading - fail closed, name both versions.
    """
    shim = tmp_path / "shim3"
    shim.mkdir()
    (shim / "radon").write_text(
        '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 9.9.9; exit 0; fi\necho "{}"\n',
        encoding="utf-8",
    )
    (shim / "radon").chmod(0o755)

    result = _run(
        tree,
        "bash",
        "scripts/check-complexity.sh",
        "--gate",
        env={"PATH": f"{shim}:{os.environ['PATH']}"},
    )
    assert result.returncode == 1
    assert "9.9.9" in result.stderr
    assert "pinned" in result.stderr.lower()
