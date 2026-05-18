"""Tests for the summary aggregator."""

from __future__ import annotations

from adaptive_learner_tracking.summary import NAMESPACE, TREND_WINDOW, aggregate


def _commit(method: str = "deductive", understanding: float = 0.6, stress: float = 0.4) -> dict:
    return {
        "method": method,
        "understanding": understanding,
        "stress": stress,
        "duration_minutes": 30,
    }


def test_returns_namespace_constant():
    # Sanity: the aggregator is namespace-agnostic; the namespace
    # constant is what the plugin / route wraps the result in.
    assert NAMESPACE == "tracking"


def test_empty_input_zero_totals():
    out = aggregate([])
    assert out["total_sessions"] == 0
    assert out["sessions_per_method"] == {}
    assert out["recent_understanding"] == []
    assert out["recent_stress"] == []
    assert out["mean_understanding"] == 0.0
    assert out["mean_stress"] == 0.0


def test_total_sessions_counts_all_rows():
    out = aggregate([_commit() for _ in range(7)])
    assert out["total_sessions"] == 7


def test_sessions_per_method_groups_by_method_key():
    out = aggregate(
        [
            _commit(method="deductive"),
            _commit(method="deductive"),
            _commit(method="dialogic"),
        ]
    )
    assert out["sessions_per_method"] == {"deductive": 2, "dialogic": 1}


def test_sessions_per_method_skips_missing_or_bad_method():
    out = aggregate(
        [
            _commit(method="deductive"),
            {"understanding": 0.5, "stress": 0.5},  # no method key
            {"method": 123, "understanding": 0.5, "stress": 0.5},  # non-string
        ]
    )
    assert out["sessions_per_method"] == {"deductive": 1}


def test_recent_understanding_keeps_only_last_window():
    commits = [_commit(understanding=i / 10) for i in range(1, 12)]  # 11 commits
    out = aggregate(commits)
    assert len(out["recent_understanding"]) == TREND_WINDOW
    # Oldest-first window; last TREND_WINDOW values are 0.7 .. 1.1
    assert out["recent_understanding"] == [0.7, 0.8, 0.9, 1.0, 1.1]


def test_recent_stress_keeps_only_last_window():
    commits = [_commit(stress=i / 10) for i in range(1, 12)]
    out = aggregate(commits)
    assert len(out["recent_stress"]) == TREND_WINDOW
    assert out["recent_stress"][0] == 0.7


def test_means_rounded_to_4_decimals():
    commits = [_commit(understanding=0.123456789) for _ in range(3)]
    out = aggregate(commits)
    assert out["mean_understanding"] == 0.1235


def test_non_numeric_understanding_skipped_from_mean():
    out = aggregate(
        [
            _commit(understanding=0.5),
            {"method": "deductive", "understanding": "garbage", "stress": 0.2},
        ]
    )
    # Only the numeric 0.5 contributes to the mean.
    assert out["mean_understanding"] == 0.5
