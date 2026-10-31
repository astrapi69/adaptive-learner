"""The release merge works for hotfix branches and with main held elsewhere (#3904).

``make release-finish`` merged ``release/$(VERSION)`` only and started with
``git checkout main``. The v2.17.1 hotfix was therefore merged by hand on a
detached ``origin/main``, and ``git checkout main`` fails whenever another
worktree holds main. ``scripts/release_finish_merge.sh`` does the merge on a
detached ``origin/main`` and checks both parents before it tags. Tested the way
it runs: as a subprocess in a real clone of a bare remote.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "release_finish_merge.sh"


def _git(cwd: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, env=_env(cwd), check=True, capture_output=True, text=True
    ).stdout.strip()


def _env(cwd: Path) -> dict[str, str]:
    home = cwd.parent / "home"
    home.mkdir(exist_ok=True)
    return {
        "PATH": os.environ["PATH"],
        "HOME": str(home),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_AUTHOR_NAME": "Test",
        "GIT_AUTHOR_EMAIL": "test@example.invalid",
        "GIT_COMMITTER_NAME": "Test",
        "GIT_COMMITTER_EMAIL": "test@example.invalid",
    }


def _commit(cwd: Path, name: str) -> str:
    (cwd / name).write_text(name, encoding="utf-8")
    _git(cwd, "add", name)
    _git(cwd, "-c", "commit.gpgsign=false", "commit", "-q", "-m", name)
    return _git(cwd, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A clone of a bare remote: main pushed, a local hotfix branch, main held by a worktree."""
    remote = tmp_path / "remote.git"
    work = tmp_path / "work"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(remote)], check=True)
    subprocess.run(["git", "clone", "-q", str(remote), str(work)], check=True, env=_env(work))
    _git(work, "symbolic-ref", "HEAD", "refs/heads/main")
    _commit(work, "base")
    _git(work, "push", "-q", "origin", "main")
    _git(work, "switch", "-q", "-c", "hotfix/v9.9.9")
    _commit(work, "fix")
    _git(work, "worktree", "add", "-q", str(tmp_path / "holder"), "main")
    return work


def _finish(work: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SCRIPT), *args], cwd=work, env=_env(work), capture_output=True, text=True
    )


def test_a_hotfix_merges_into_main_while_another_worktree_holds_main(repo: Path) -> None:
    old_main = _git(repo, "rev-parse", "main")
    fix = _git(repo, "rev-parse", "hotfix/v9.9.9")

    result = _finish(repo, "9.9.9", "hotfix/v9.9.9")

    assert result.returncode == 0, result.stderr
    remote_main = _git(repo, "ls-remote", "origin", "refs/heads/main").split()[0]
    assert _git(repo, "rev-parse", f"{remote_main}^1") == old_main
    assert _git(repo, "rev-parse", f"{remote_main}^2") == fix
    tagged = _git(repo, "ls-remote", "origin", "refs/tags/v9.9.9^{}").split()[0]
    assert tagged == remote_main


def test_a_branch_already_in_main_is_refused_before_the_tag(repo: Path) -> None:
    assert _finish(repo, "9.9.9", "hotfix/v9.9.9").returncode == 0

    again = _finish(repo, "9.9.10", "hotfix/v9.9.9")

    assert again.returncode != 0
    assert _git(repo, "ls-remote", "origin", "refs/tags/v9.9.10") == ""


@pytest.mark.parametrize(
    ("override", "branch"),
    [([], "release/9.9.9"), (["FINISH_BRANCH=hotfix/v9.9.9"], "hotfix/v9.9.9")],
    ids=["release-by-default", "hotfix-on-request"],
)
def test_make_release_finish_hands_its_branch_to_the_merge_and_the_back_merge(
    override: list[str], branch: str
) -> None:
    dry = subprocess.run(
        ["make", "-n", "release-finish", "VERSION=9.9.9", *override],
        cwd=SCRIPT.parents[1],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    assert f"scripts/release_finish_merge.sh 9.9.9 {branch}" in dry
    assert f"--base develop --head {branch}" in dry
    assert "git checkout main" not in dry


@pytest.mark.parametrize(
    "branch", ["feature/x", "develop", "main"], ids=["feature", "develop", "main"]
)
def test_only_release_and_hotfix_branches_are_merged(repo: Path, branch: str) -> None:
    result = _finish(repo, "9.9.9", branch)

    assert result.returncode == 2
    assert _git(repo, "ls-remote", "origin", "refs/tags/v9.9.9") == ""
