"""Self-checks for the ``plugin-lock-paired-with-pyproject`` pre-commit hook (#3657).

The hook (``scripts/check_plugin_lock_paired.py``) runs ``poetry check --lock``
for every plugin whose ``pyproject.toml`` or ``poetry.lock`` pre-commit hands
it. It used to check the staging instead, which in CI (``--all-files``,
nothing staged) examined nothing and reported success. These tests run the
hook as pre-commit does, as a subprocess from a repo root, against a copy of
a real plugin's pyproject and lock, so the lock format and poetry's own
content-hash rule are the ones the repository actually uses.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
HOOK = REPO / "scripts" / "check_plugin_lock_paired.py"
SOURCE_PLUGIN = REPO / "plugins" / "adaptive-learner-plugin-tools"
PLUGIN = "plugins/adaptive-learner-plugin-tools"

pytestmark = pytest.mark.skipif(shutil.which("poetry") is None, reason="needs poetry")


@pytest.fixture
def root(tmp_path: Path) -> Path:
    plugin = tmp_path / PLUGIN
    plugin.mkdir(parents=True)
    for name in ("pyproject.toml", "poetry.lock"):
        shutil.copy(SOURCE_PLUGIN / name, plugin / name)
    return tmp_path


def _run(
    root: Path, *paths: str, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(HOOK), *paths],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )


def _edit(root: Path, old: str, new: str) -> None:
    path = root / PLUGIN / "pyproject.toml"
    text = path.read_text(encoding="utf-8")
    assert old in text
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def test_fresh_lock_passes_and_reports_what_it_checked(root: Path) -> None:
    result = _run(root, f"{PLUGIN}/pyproject.toml", f"{PLUGIN}/poetry.lock")
    assert result.returncode == 0, result.stdout
    assert "checked 1 plugin(s), 0 with a stale or missing lock" in result.stdout


def test_dependency_change_without_relock_fails(root: Path) -> None:
    _edit(root, "[tool.poetry.dependencies]\n", '[tool.poetry.dependencies]\nrequests = "^2.32"\n')
    result = _run(root, f"{PLUGIN}/pyproject.toml")
    assert result.returncode == 1
    assert "changed significantly" in result.stdout
    assert "poetry lock" in result.stdout


def test_version_only_bump_passes(root: Path) -> None:
    """make sync-versions moves only ``version``; poetry keeps it out of the hash (#1903)."""
    path = root / PLUGIN / "pyproject.toml"
    text = path.read_text(encoding="utf-8")
    bumped = "\n".join(
        'version = "9.9.9"' if line.startswith("version = ") else line for line in text.split("\n")
    )
    assert bumped != text
    path.write_text(bumped, encoding="utf-8")
    assert _run(root, f"{PLUGIN}/pyproject.toml").returncode == 0


def test_missing_lock_fails(root: Path) -> None:
    (root / PLUGIN / "poetry.lock").unlink()
    result = _run(root, f"{PLUGIN}/pyproject.toml")
    assert result.returncode == 1 and "no poetry.lock" in result.stdout


def test_stale_lock_fails_with_nothing_staged(root: Path) -> None:
    """The CI shape: --all-files, no git index at all. The old hook passed this."""
    _edit(root, "[tool.poetry.dependencies]\n", '[tool.poetry.dependencies]\nrequests = "^2.32"\n')
    assert not (root / ".git").exists()
    assert _run(root, f"{PLUGIN}/poetry.lock").returncode == 1


def test_fails_closed_without_poetry(root: Path) -> None:
    env = {**os.environ, "PATH": str(Path(sys.executable).parent)}
    if shutil.which("poetry", path=env["PATH"]):
        pytest.skip("poetry lives next to the interpreter; cannot hide it")
    result = _run(root, f"{PLUGIN}/pyproject.toml", env=env)
    assert result.returncode == 2 and "FAIL-CLOSED" in result.stdout


def test_non_plugin_paths_are_a_no_op(root: Path) -> None:
    result = _run(root, "backend/pyproject.toml", "README.md")
    assert result.returncode == 0 and result.stdout == ""
