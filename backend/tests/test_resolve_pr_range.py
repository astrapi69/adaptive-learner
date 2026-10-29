"""Pins the pull_request range resolver for the rule change log check (#3884).

The CI checkout is shallow. A hotfix branch carries main's whole history,
so with the step's depth-200 fetch the walk ``origin/develop..<head>`` ran
past develop's cut and listed 2389 commits instead of 10 (#3883). Per the
#2083 gate contract: the resolver yields the true range for a main-based
branch, costs nothing extra for a develop-based one, and fails closed when
the head cannot be fetched or the range is still cut after the full fetch.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "resolve_pr_range.py"
DEPTH = "3"


def _git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True, text=True
    ).stdout.strip()


def _commit(root: Path, message: str) -> str:
    (root / "a.txt").write_text(message, encoding="utf-8")
    _git(root, "add", "-A")
    _git(root, "commit", "-qm", message)
    return _git(root, "rev-parse", "HEAD")


def _run(clone: Path, head: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--base", "develop", "--head", head, "--depth", DEPTH],
        capture_output=True,
        text=True,
        cwd=clone,
    )


def _is_shallow(clone: Path) -> bool:
    return _git(clone, "rev-parse", "--is-shallow-repository") == "true"


@pytest.fixture
def origin(tmp_path: Path) -> Path:
    """Gitflow in miniature: a release merged into main and back into
    develop, develop moving on far past the fetch depth, then a hotfix
    commit on main and a feature commit on develop."""
    repo = tmp_path / "origin"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "develop")
    _git(repo, "config", "user.email", "t@example.com")
    _git(repo, "config", "user.name", "test")
    _git(repo, "config", "uploadpack.allowReachableSHA1InWant", "true")
    _commit(repo, "chore: root")
    _git(repo, "branch", "main")
    _commit(repo, "feat: before the release")
    _git(repo, "checkout", "-q", "-b", "release/1")
    _commit(repo, "chore(release): bump")
    _git(repo, "checkout", "-q", "main")
    _git(repo, "merge", "-q", "--no-ff", "-m", "Release 1", "release/1")
    _git(repo, "checkout", "-q", "develop")
    _git(repo, "merge", "-q", "--no-ff", "-m", "Merge release/1 back into develop", "release/1")
    for i in range(10):
        _commit(repo, f"feat: develop moves on {i}")
    _git(repo, "checkout", "-q", "-b", "hotfix/1.0.1", "main")
    _commit(repo, "fix: the hotfix")
    _git(repo, "checkout", "-q", "-b", "feat/x", "develop")
    _commit(repo, "feat: a feature")
    _git(repo, "checkout", "-q", "develop")
    return repo


@pytest.fixture
def clone(origin: Path, tmp_path: Path) -> Path:
    """The CI checkout: develop at depth 1 over a URL, so the depth holds."""
    target = tmp_path / "clone"
    _git(tmp_path, "clone", "-q", "--depth=1", "--branch", "develop", origin.as_uri(), str(target))
    return target


def test_a_hotfix_branch_gets_its_true_range(origin: Path, clone: Path) -> None:
    head = _git(origin, "rev-parse", "hotfix/1.0.1")
    true_count = _git(origin, "rev-list", "--count", f"develop..{head}")

    result = _run(clone, head)

    assert result.returncode == 0, result.stderr
    rev_range = result.stdout.strip()
    assert rev_range == f"origin/develop..{head}"
    assert _git(clone, "rev-list", "--count", rev_range) == true_count == "2"
    assert "full history" in result.stderr


def test_without_the_resolver_the_shallow_range_is_too_long(origin: Path, clone: Path) -> None:
    """The reproduction: the step's plain fetch, as before #3884."""
    head = _git(origin, "rev-parse", "hotfix/1.0.1")
    _git(clone, "fetch", "-q", "--no-tags", f"--depth={DEPTH}", "origin", "develop", head)

    assert int(_git(clone, "rev-list", "--count", f"origin/develop..{head}")) > 2


def test_a_develop_branch_stays_shallow(origin: Path, clone: Path) -> None:
    head = _git(origin, "rev-parse", "feat/x")

    result = _run(clone, head)

    assert result.returncode == 0, result.stderr
    assert _git(clone, "rev-list", "--count", result.stdout.strip()) == "1"
    assert _is_shallow(clone)
    assert result.stderr == ""


def test_an_unknown_head_fails_closed(clone: Path) -> None:
    result = _run(clone, "0" * 40)

    assert result.returncode == 1
    assert result.stdout == ""


def test_a_range_still_cut_after_the_full_fetch_fails_closed(
    origin: Path, clone: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """If the full fetch leaves the cut in place, checking the wrong range
    would print a green that measured nothing."""
    spec = importlib.util.spec_from_file_location("resolve_pr_range", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    real_fetch = module.fetch

    def depth_only(root: Path, remote: str, base: str, head: str, depth: int | None) -> None:
        if depth is not None:
            real_fetch(root, remote, base, head, depth)

    monkeypatch.setattr(module, "fetch", depth_only)
    monkeypatch.chdir(clone)
    head = _git(origin, "rev-parse", "hotfix/1.0.1")
    monkeypatch.setattr(
        sys, "argv", ["resolve_pr_range.py", "--base", "develop", "--head", head, "--depth", DEPTH]
    )

    assert module.main() == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "still" in captured.err


def test_the_ci_step_resolves_its_pull_request_range_with_the_resolver() -> None:
    """The step's own depth-200 fetch was the cut; it must not come back
    beside the resolver, and a resolver failure must stop the step."""
    ci = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    step = ci[ci.index("- name: Check the rule change log is current") :]
    step = step[: step.index("      - name:", 10)]
    pr_branch = "\n".join(
        line for line in step[: step.index("else")].splitlines() if not line.strip().startswith("#")
    )
    assert 'RANGE="$(python3 scripts/resolve_pr_range.py' in pr_branch
    assert "--depth" not in pr_branch
    assert "set -euo pipefail" in step
