"""Pins the Docker-context guard (#2112).

`bun run build` died in the frontend stage on a symlink under
`frontend/public/content/.../node_modules/.bin/` that points ABSOLUTELY
into a sibling repo: it resolves on the machine and dangles in the
container, where the target lies outside the build context. The single
`frontend/node_modules` ignore entry missed every nested one.

Gate contract (#2083): it detects the violation, passes on a clean tree,
fails closed without its basis, and reports what it examined - a scan
that walked nothing must not read like a clean one.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "verify_docker_context.py"


def _run(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root)],
        capture_output=True,
        text=True,
    )


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    (tmp_path / "frontend" / "public" / "content" / "linked").mkdir(parents=True)
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "app.py").write_text("x\n", encoding="utf-8")
    return tmp_path


def _ignore(root: Path, *lines: str) -> None:
    (root / ".dockerignore").write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_detects_a_nested_node_modules(tree: Path) -> None:
    (tree / "frontend" / "public" / "content" / "linked" / "node_modules").mkdir()
    _ignore(tree, "frontend/node_modules", ".git")
    result = _run(tree)
    assert result.returncode == 1
    assert "node_modules" in result.stderr
    assert "must not be" in result.stderr


def test_passes_when_the_rules_cover_it(tree: Path) -> None:
    (tree / "frontend" / "public" / "content" / "linked" / "node_modules").mkdir()
    _ignore(tree, "**/node_modules", ".git")
    result = _run(tree)
    assert result.returncode == 0, result.stderr
    assert "clean" in result.stdout


def test_reports_what_it_examined(tree: Path) -> None:
    """Point 4: an empty scan and a clean scan must not print the same green."""
    _ignore(tree, "**/node_modules")
    result = _run(tree)
    assert result.returncode == 0
    assert "paths examined" in result.stdout
    examined = int(result.stdout.split("docker context: ")[1].split(" ")[0])
    assert examined > 0


def test_fails_closed_without_a_dockerignore(tree: Path) -> None:
    result = _run(tree)
    assert result.returncode == 1
    assert "missing" in result.stderr


def test_fails_closed_on_an_empty_dockerignore(tree: Path) -> None:
    """No patterns means the rules cannot be evaluated - not that they pass."""
    _ignore(tree, "# only a comment")
    result = _run(tree)
    assert result.returncode == 1
    assert "no patterns" in result.stderr


def test_the_real_repo_context_is_clean(tree: Path) -> None:
    """The regression pin itself: this repo must stay clean."""
    result = _run(REPO_ROOT)
    assert result.returncode == 0, result.stdout + result.stderr
