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


# --- Phase 7B: new fields -------------------------------------------------


from datetime import date  # noqa: E402  (kept with the v0.4.0 tests for visual grouping)


def _commit_on(day: date, method: str = "deductive", duration: int = 30) -> dict:
    return {
        "id": f"c-{day.isoformat()}-{method}",
        "method": method,
        "understanding": 0.6,
        "stress": 0.4,
        "duration_minutes": duration,
        "committed_at": f"{day.isoformat()}T10:00:00+00:00",
    }


def test_total_minutes_sums_duration():
    out = aggregate(
        [
            _commit_on(date(2026, 5, 1), duration=30),
            _commit_on(date(2026, 5, 2), duration=45),
            _commit_on(date(2026, 5, 3), duration=15),
        ]
    )
    assert out["total_minutes"] == 90


def test_total_minutes_skips_non_numeric():
    out = aggregate(
        [
            _commit_on(date(2026, 5, 1), duration=30),
            {"method": "deductive", "duration_minutes": "garbage"},
        ]
    )
    assert out["total_minutes"] == 30


def test_streak_three_consecutive_days_ending_today():
    today = date(2026, 5, 18)
    commits = [
        _commit_on(date(2026, 5, 16)),
        _commit_on(date(2026, 5, 17)),
        _commit_on(date(2026, 5, 18)),
    ]
    out = aggregate(commits, today=today)
    assert out["streak_days"] == 3


def test_streak_zero_when_no_commit_today():
    """Strict 'missed today' rule: if today isn't in the commit
    dates, the streak resets to 0 even if yesterday was active.
    Matches the Duolingo / Habitica convention."""
    today = date(2026, 5, 18)
    commits = [
        _commit_on(date(2026, 5, 16)),
        _commit_on(date(2026, 5, 17)),
    ]
    out = aggregate(commits, today=today)
    assert out["streak_days"] == 0


def test_streak_stops_at_first_gap():
    today = date(2026, 5, 18)
    commits = [
        _commit_on(date(2026, 5, 10)),
        # gap on the 11th
        _commit_on(date(2026, 5, 12)),
        _commit_on(date(2026, 5, 17)),
        _commit_on(date(2026, 5, 18)),
    ]
    out = aggregate(commits, today=today)
    # Only the most recent 18 + 17 form the active streak.
    assert out["streak_days"] == 2


def test_streak_multiple_commits_same_day_count_as_one():
    today = date(2026, 5, 18)
    commits = [
        _commit_on(date(2026, 5, 18)),
        _commit_on(date(2026, 5, 18), method="dialogic"),
        _commit_on(date(2026, 5, 18), method="error_based"),
    ]
    out = aggregate(commits, today=today)
    assert out["streak_days"] == 1


def test_streak_tolerates_malformed_committed_at():
    today = date(2026, 5, 18)
    commits = [
        _commit_on(date(2026, 5, 18)),
        {"method": "deductive", "committed_at": "not-a-date"},
        {"method": "deductive", "committed_at": None},
    ]
    out = aggregate(commits, today=today)
    # Malformed entries are dropped; today still counts.
    assert out["streak_days"] == 1


def test_method_distribution_emits_one_entry_per_method():
    out = aggregate(
        [
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="dialogic"),
        ],
        today=date(2026, 5, 18),
    )
    methods = {entry["method"] for entry in out["method_distribution"]}
    assert methods == {
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    }
    # Counts match.
    counts = {e["method"]: e["count"] for e in out["method_distribution"]}
    assert counts["deductive"] == 2
    assert counts["dialogic"] == 1
    assert counts["inductive"] == 0


def test_method_distribution_percentages_sum_to_100_when_data_exists():
    out = aggregate(
        [
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="dialogic"),
            _commit_on(date(2026, 5, 18), method="error_based"),
        ],
        today=date(2026, 5, 18),
    )
    pct_sum = sum(e["percentage"] for e in out["method_distribution"])
    # Rounding can shift +/-1; pin tightly to catch a regression
    # where percentages don't scale to ~100.
    assert 99 <= pct_sum <= 100


def test_method_distribution_sorted_by_count_descending():
    out = aggregate(
        [
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="deductive"),
            _commit_on(date(2026, 5, 18), method="dialogic"),
            _commit_on(date(2026, 5, 18), method="dialogic"),
            _commit_on(date(2026, 5, 18), method="error_based"),
        ],
        today=date(2026, 5, 18),
    )
    counts = [e["count"] for e in out["method_distribution"]]
    # Strictly non-increasing.
    assert counts == sorted(counts, reverse=True)


def test_method_distribution_zero_total_keeps_zero_percentages():
    out = aggregate([])
    pct = [e["percentage"] for e in out["method_distribution"]]
    counts = [e["count"] for e in out["method_distribution"]]
    assert pct == [0, 0, 0, 0, 0, 0]
    assert counts == [0, 0, 0, 0, 0, 0]


def test_recent_sessions_newest_first_capped_at_window():
    today = date(2026, 5, 18)
    commits = [_commit_on(date(2026, 5, day)) for day in range(1, 11)]  # 10 commits
    out = aggregate(commits, today=today)
    recent = out["recent_sessions"]
    assert len(recent) == TREND_WINDOW  # 5
    # Newest first: the last commit (day=10) leads.
    assert recent[0]["committed_at"].startswith("2026-05-10")
    assert recent[-1]["committed_at"].startswith("2026-05-06")


def test_recent_sessions_carries_id_method_duration_and_ratings():
    out = aggregate(
        [
            _commit_on(date(2026, 5, 18), method="dialogic", duration=42),
        ],
        today=date(2026, 5, 18),
    )
    row = out["recent_sessions"][0]
    assert row["id"] == "c-2026-05-18-dialogic"
    assert row["method"] == "dialogic"
    assert row["duration_minutes"] == 42
    assert row["understanding"] == 0.6
    assert row["stress"] == 0.4
    assert row["committed_at"] == "2026-05-18T10:00:00+00:00"


def test_recent_sessions_empty_when_no_commits():
    out = aggregate([])
    assert out["recent_sessions"] == []
