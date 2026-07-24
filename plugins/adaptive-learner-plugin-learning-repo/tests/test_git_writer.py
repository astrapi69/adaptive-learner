"""Tests for the subprocess-git writer (BL-30 commit 5).

Uses ``tmp_path`` + a real ``git`` binary (the dev + CI envs
both ship git). The missing-git-binary case is exercised via
``shutil.which`` monkey-patching.
"""

from __future__ import annotations

import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from adaptive_learner_learning_repo.context import RenderContext, derive_topics
from adaptive_learner_learning_repo.git_writer import (
    PersistResult,
    persist_to_disk_and_commit,
)

pytestmark = pytest.mark.skipif(
    shutil.which("git") is None,
    reason="git binary not on PATH; persistence tests rely on a real git for byte-level confidence.",
)


# --- Helpers ------------------------------------------------------------


def _session(sid: str, *, started: datetime, cycle_topics: str = "[]"):
    return SimpleNamespace(
        id=sid,
        project_id="p-1",
        method="ai_adaptive",
        started_at=started,
        ended_at=started + timedelta(minutes=30),
        cycle_step=7,
        status="completed",
        cycle_count=1,
        cycle_topics=cycle_topics,
    )


def _rating(sid: str, *, understanding: int, method_fit: int, stress: int = 1):
    return SimpleNamespace(
        id=f"r-{sid}",
        session_id=sid,
        understanding=understanding,
        stress=stress,
        method_fit=method_fit,
        notes=None,
        created_at=datetime(2026, 5, 25, 10, 0, 0),
    )


def _ctx(sessions=(), ratings=(), *, topic="Docker") -> RenderContext:
    return RenderContext(
        project=SimpleNamespace(id="p-1", topic=topic, goal="QA", active=True),
        sessions=tuple(sessions),
        ratings=tuple(ratings),
        step_evaluations=(),
        method_switches=(),
        notes=(),
        topics=derive_topics(tuple(sessions)),
    )


def _git_log(repo: Path) -> str:
    return subprocess.run(
        ["git", "log", "--oneline", "--decorate", "--all"],
        cwd=str(repo),
        check=True,
        capture_output=True,
        text=True,
    ).stdout


# --- Happy paths --------------------------------------------------------


def test_persist_initializes_repo_writes_tree_and_commits(tmp_path: Path) -> None:
    tree = {"README.md": "hello\n", "subdir/file.md": "world\n"}
    result = persist_to_disk_and_commit(tree, tmp_path, "p-1", _ctx())
    repo = tmp_path / "p-1"
    assert (repo / ".git").is_dir()
    assert (repo / "README.md").read_text() == "hello\n"
    assert (repo / "subdir" / "file.md").read_text() == "world\n"
    assert isinstance(result, PersistResult)
    assert result.repo_path == repo
    assert result.files_written == 2
    assert len(result.commit_sha) == 40  # full SHA from git rev-parse HEAD


def test_persist_commit_message_subject_carries_cycle_and_latest_rating(
    tmp_path: Path,
) -> None:
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
    ]
    ratings = [
        _rating("s1", understanding=4, method_fit=3),
        _rating("s2", understanding=5, method_fit=4),
    ]
    persist_to_disk_and_commit({"README.md": "x\n"}, tmp_path, "p-1", _ctx(sessions, ratings))
    repo = tmp_path / "p-1"
    last_subject = subprocess.run(
        ["git", "log", "-1", "--pretty=%s"],
        cwd=str(repo),
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    # Latest session is s2 → U 10/10, T 8/10. Cycle count = 2.
    assert last_subject == "Cycle 2 - U 10/10, T 8/10"


def test_persist_commit_subject_when_no_sessions_yet(tmp_path: Path) -> None:
    persist_to_disk_and_commit({"README.md": "x\n"}, tmp_path, "p-1", _ctx())
    repo = tmp_path / "p-1"
    subject = subprocess.run(
        ["git", "log", "-1", "--pretty=%s"],
        cwd=str(repo),
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert subject == "Initial render - no sessions yet"


def test_persist_is_idempotent_for_unchanged_tree(tmp_path: Path) -> None:
    """Re-rendering the same content twice does NOT crash; the
    second call resolves to the same HEAD SHA without a new
    commit being created."""

    tree = {"README.md": "stable\n"}
    first = persist_to_disk_and_commit(tree, tmp_path, "p-1", _ctx())
    second = persist_to_disk_and_commit(tree, tmp_path, "p-1", _ctx())
    assert first.commit_sha == second.commit_sha


def test_persist_creates_new_commit_when_content_changes(tmp_path: Path) -> None:
    first = persist_to_disk_and_commit({"README.md": "v1\n"}, tmp_path, "p-1", _ctx())
    second = persist_to_disk_and_commit({"README.md": "v2\n"}, tmp_path, "p-1", _ctx())
    assert first.commit_sha != second.commit_sha


# --- Tagging on exit threshold ------------------------------------------


def test_persist_tags_cycle_when_exit_threshold_met(tmp_path: Path) -> None:
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
    ]
    ratings = [
        _rating("s1", understanding=5, method_fit=5),
        _rating("s2", understanding=5, method_fit=5),
    ]
    result = persist_to_disk_and_commit(
        {"README.md": "x\n"}, tmp_path, "p-1", _ctx(sessions, ratings)
    )
    assert result.tag == "cycle-2-mastered"
    assert "cycle-2-mastered" in _git_log(tmp_path / "p-1")


def test_persist_skips_tag_when_threshold_not_met(tmp_path: Path) -> None:
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", started=base)]
    ratings = [_rating("s1", understanding=3, method_fit=3)]
    result = persist_to_disk_and_commit(
        {"README.md": "x\n"}, tmp_path, "p-1", _ctx(sessions, ratings)
    )
    assert result.tag is None
    assert "mastered" not in _git_log(tmp_path / "p-1")


def test_persist_tag_is_idempotent_at_same_cycle(tmp_path: Path) -> None:
    """A second render at the same cycle leaves the existing tag
    pointing at the original commit. Return shape carries
    ``tag=None`` on the second call because no new tag was created."""

    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
    ]
    ratings = [
        _rating("s1", understanding=5, method_fit=5),
        _rating("s2", understanding=5, method_fit=5),
    ]
    first = persist_to_disk_and_commit(
        {"README.md": "v1\n"}, tmp_path, "p-1", _ctx(sessions, ratings)
    )
    second = persist_to_disk_and_commit(
        {"README.md": "v2\n"}, tmp_path, "p-1", _ctx(sessions, ratings)
    )
    assert first.tag == "cycle-2-mastered"
    assert second.tag is None  # tag already exists, not re-created
    # And the tag still points at the original commit (the first one).
    sha = subprocess.run(
        ["git", "rev-list", "-n", "1", "cycle-2-mastered"],
        cwd=str(tmp_path / "p-1"),
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert sha == first.commit_sha


# Missing-git fallback test lives in
# ``backend/tests/test_learning_repo_plugin_integration.py``
# because it asserts on ``app.exceptions.ExternalServiceError``
# — that module isn't importable from the plugin's smoke-test
# env where ``app/`` isn't on sys.path.
