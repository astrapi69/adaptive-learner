"""Tests for the shared exit-threshold helper (BL-30 commit 5).

The stats-table pin (``meta/stats.py``) and the git-tagger
(``git_writer.py``) both consume this. These tests pin the
shared logic so any change has a single fail-loud surface.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace

from adaptive_learner_learning_repo.context import RenderContext, derive_topics
from adaptive_learner_learning_repo.thresholds import (
    TRANSFER_OUT_OF_TEN_MIN,
    UNDERSTANDING_OUT_OF_TEN_MIN,
    exit_threshold_indices,
    latest_exit_threshold_cycle,
    meets_per_session_bar,
)


def _session(sid: str, *, started: datetime, method: str = "ai_adaptive"):
    return SimpleNamespace(
        id=sid,
        project_id="p-1",
        method=method,
        started_at=started,
        ended_at=started + timedelta(minutes=30),
        cycle_step=7,
        status="completed",
        cycle_count=1,
        cycle_topics="[]",
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


def _ctx(sessions=(), ratings=()) -> RenderContext:
    return RenderContext(
        project=SimpleNamespace(id="p-1", topic="X", goal="Y", active=True),
        sessions=tuple(sessions),
        ratings=tuple(ratings),
        step_evaluations=(),
        method_switches=(),
        notes=(),
        topics=derive_topics(tuple(sessions)),
    )


# --- threshold constants are the values the spec calls for --------------


def test_threshold_constants_match_article_1_spec():
    assert UNDERSTANDING_OUT_OF_TEN_MIN == 9
    assert TRANSFER_OUT_OF_TEN_MIN == 8


# --- meets_per_session_bar ----------------------------------------------


def test_meets_per_session_bar_true_when_both_dimensions_clear():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", started=base)]
    # 5/5 * 2 = 10/10 ≥ 9, 4/5 * 2 = 8/10 ≥ 8.
    ratings = [_rating("s1", understanding=5, method_fit=4)]
    assert meets_per_session_bar("s1", _ctx(sessions, ratings)) is True


def test_meets_per_session_bar_false_when_understanding_below_9():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", started=base)]
    # 4/5 * 2 = 8/10 < 9.
    ratings = [_rating("s1", understanding=4, method_fit=4)]
    assert meets_per_session_bar("s1", _ctx(sessions, ratings)) is False


def test_meets_per_session_bar_false_when_transfer_below_8():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", started=base)]
    # 5/5 * 2 = 10/10, 3/5 * 2 = 6/10 < 8.
    ratings = [_rating("s1", understanding=5, method_fit=3)]
    assert meets_per_session_bar("s1", _ctx(sessions, ratings)) is False


def test_meets_per_session_bar_false_when_session_has_no_rating():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", started=base)]
    assert meets_per_session_bar("s1", _ctx(sessions, ratings=())) is False


# --- exit_threshold_indices ---------------------------------------------


def test_exit_threshold_indices_session_0_never_qualifies():
    """The "stable over 2 cycles" rule needs a predecessor — the
    very first session can never satisfy it on its own."""
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", started=base)]
    ratings = [_rating("s1", understanding=5, method_fit=5)]
    assert exit_threshold_indices(_ctx(sessions, ratings)) == set()


def test_exit_threshold_indices_pinned_when_two_consecutive_pass():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
    ]
    ratings = [
        _rating("s1", understanding=5, method_fit=4),  # 10/10, 8/10
        _rating("s2", understanding=5, method_fit=5),  # 10/10, 10/10
    ]
    assert exit_threshold_indices(_ctx(sessions, ratings)) == {1}


def test_exit_threshold_indices_gap_resets():
    """If a passing session is followed by a failing one, then
    another passing one, the second-passing session does NOT
    qualify until ANOTHER passing session follows it."""
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
        _session("s3", started=base + timedelta(hours=2)),
    ]
    ratings = [
        _rating("s1", understanding=5, method_fit=5),  # pass
        _rating("s2", understanding=3, method_fit=3),  # fail
        _rating("s3", understanding=5, method_fit=5),  # pass — but predecessor failed
    ]
    assert exit_threshold_indices(_ctx(sessions, ratings)) == set()


def test_exit_threshold_indices_sorts_by_started_at():
    """Pin selection runs over started_at-sorted sessions, not
    over the input order. Out-of-order context still gives a
    deterministic result."""
    base = datetime(2026, 5, 20, 9, 0, 0)
    s_late = _session("s_late", started=base + timedelta(hours=1))
    s_early = _session("s_early", started=base)
    ratings = [
        _rating("s_early", understanding=5, method_fit=5),
        _rating("s_late", understanding=5, method_fit=5),
    ]
    # Unsorted input — late first.
    ctx = _ctx((s_late, s_early), ratings)
    # After sorting by started_at: index 0 = s_early, index 1 = s_late.
    # s_late qualifies because its predecessor (s_early) passed too.
    assert exit_threshold_indices(ctx) == {1}


# --- latest_exit_threshold_cycle ----------------------------------------


def test_latest_exit_threshold_cycle_none_when_no_pins():
    assert latest_exit_threshold_cycle(_ctx()) is None


def test_latest_exit_threshold_cycle_returns_one_indexed_position():
    """``cycle`` is 1-indexed — index 1 means "second session"
    in the started_at order, which the git tag exposes to the
    user as ``cycle-2-mastered``."""
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
    ]
    ratings = [
        _rating("s1", understanding=5, method_fit=5),
        _rating("s2", understanding=5, method_fit=5),
    ]
    assert latest_exit_threshold_cycle(_ctx(sessions, ratings)) == 2


def test_latest_exit_threshold_cycle_returns_highest_when_multiple_pins():
    """The git tagger only needs the most recent pin — older
    pins already have their own tags from prior renders."""
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", started=base),
        _session("s2", started=base + timedelta(hours=1)),
        _session("s3", started=base + timedelta(hours=2)),
    ]
    ratings = [
        _rating("s1", understanding=5, method_fit=5),  # pass
        _rating("s2", understanding=5, method_fit=5),  # pass — pin at index 1
        _rating("s3", understanding=5, method_fit=5),  # pass — pin at index 2
    ]
    # Highest pin is index 2 → cycle 3.
    assert latest_exit_threshold_cycle(_ctx(sessions, ratings)) == 3
