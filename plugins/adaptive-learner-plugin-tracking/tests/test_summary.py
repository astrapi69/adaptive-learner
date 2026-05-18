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


# --- v0.5.0 / 8D step-evaluation aggregator -------------------------------

from adaptive_learner_tracking.summary import (  # noqa: E402 — grouped with 8D tests
    aggregate_step_evaluations,
)


def _eval(
    *,
    session_id: str = "s-1",
    from_step: int = 1,
    to_step: int = 2,
    applied: bool = True,
    advance: bool = True,
    fallback_used: bool = False,
    confidence: float = 0.9,
    reason: str = "ok",
    evaluated_at: str = "2026-05-18T10:00:00+00:00",
) -> dict:
    return {
        "id": f"e-{session_id}-{evaluated_at}",
        "session_id": session_id,
        "from_step": from_step,
        "to_step": to_step,
        "applied": applied,
        "advance": advance,
        "fallback_used": fallback_used,
        "confidence": confidence,
        "reason": reason,
        "evaluated_at": evaluated_at,
    }


def test_empty_evaluations_yields_zeros():
    out = aggregate_step_evaluations([])
    assert out["total_evaluations"] == 0
    assert out["average_confidence"] == 0.0
    assert out["advance_count"] == 0
    assert out["repeat_count"] == 0
    assert out["backward_count"] == 0
    assert out["fallback_count"] == 0
    assert out["evaluations_per_step"] == {}
    assert out["time_seconds_per_step"] == {}


def test_average_confidence_mean_across_all_rows():
    out = aggregate_step_evaluations(
        [
            _eval(confidence=0.9, evaluated_at="2026-05-18T10:00:00+00:00"),
            _eval(confidence=0.6, evaluated_at="2026-05-18T10:01:00+00:00"),
            _eval(confidence=0.3, evaluated_at="2026-05-18T10:02:00+00:00"),
        ]
    )
    assert out["total_evaluations"] == 3
    assert out["average_confidence"] == 0.6  # (0.9+0.6+0.3)/3


def test_advance_repeat_backward_counts_are_mutually_exclusive():
    out = aggregate_step_evaluations(
        [
            # Forward applied → advance_count
            _eval(from_step=1, to_step=2, applied=True),
            # Forward, but not applied → repeat_count
            _eval(from_step=2, to_step=3, applied=False),
            # Backward applied → backward_count
            _eval(from_step=4, to_step=2, applied=True),
            # Repeat-applied (to_step == from_step) → repeat_count
            _eval(from_step=3, to_step=3, applied=False),
        ]
    )
    assert out["advance_count"] == 1
    assert out["backward_count"] == 1
    assert out["repeat_count"] == 2  # 2 rows had applied=False


def test_fallback_count_independent_of_applied():
    out = aggregate_step_evaluations(
        [
            _eval(fallback_used=True, applied=True),
            _eval(fallback_used=True, applied=False),
            _eval(fallback_used=False, applied=True),
        ]
    )
    assert out["fallback_count"] == 2


def test_evaluations_per_step_counts_by_from_step():
    out = aggregate_step_evaluations(
        [
            _eval(from_step=2),
            _eval(from_step=2),
            _eval(from_step=2),
            _eval(from_step=4),
            _eval(from_step=4),
            _eval(from_step=1),
        ]
    )
    assert out["evaluations_per_step"] == {2: 3, 4: 2, 1: 1}


def test_time_seconds_per_step_sums_gaps_within_session():
    """Two evaluations in the same session, 60s apart → 60s on
    the FIRST row's from_step."""
    out = aggregate_step_evaluations(
        [
            _eval(
                session_id="s-1",
                from_step=2,
                evaluated_at="2026-05-18T10:00:00+00:00",
            ),
            _eval(
                session_id="s-1",
                from_step=3,
                evaluated_at="2026-05-18T10:01:00+00:00",
            ),
        ]
    )
    assert out["time_seconds_per_step"] == {2: 60.0}


def test_time_seconds_per_step_separates_sessions():
    """Gaps are computed PER session. Two sessions each on step 2,
    each contributing 60s → 120s total on step 2."""
    out = aggregate_step_evaluations(
        [
            _eval(
                session_id="s-1",
                from_step=2,
                evaluated_at="2026-05-18T10:00:00+00:00",
            ),
            _eval(
                session_id="s-1",
                from_step=3,
                evaluated_at="2026-05-18T10:01:00+00:00",
            ),
            _eval(
                session_id="s-2",
                from_step=2,
                evaluated_at="2026-05-18T11:00:00+00:00",
            ),
            _eval(
                session_id="s-2",
                from_step=3,
                evaluated_at="2026-05-18T11:01:00+00:00",
            ),
        ]
    )
    assert out["time_seconds_per_step"] == {2: 120.0}


def test_time_seconds_per_step_excludes_long_gaps():
    """Gaps longer than 2h are excluded (almost certainly idle
    learner, not "time on step")."""
    out = aggregate_step_evaluations(
        [
            _eval(
                session_id="s-1",
                from_step=2,
                evaluated_at="2026-05-18T10:00:00+00:00",
            ),
            # 3 hours later — should be excluded.
            _eval(
                session_id="s-1",
                from_step=3,
                evaluated_at="2026-05-18T13:00:00+00:00",
            ),
            # 30 seconds later — counted toward step 3.
            _eval(
                session_id="s-1",
                from_step=4,
                evaluated_at="2026-05-18T13:00:30+00:00",
            ),
        ]
    )
    # Only the 30s gap survives: it's on step 3.
    assert out["time_seconds_per_step"] == {3: 30.0}


def test_time_seconds_per_step_ignores_zero_gap_identical_timestamps():
    """Two evaluations with identical timestamps contribute nothing
    to time-per-step — the gap is 0 seconds and the aggregator skips
    rows where delta <= 0."""
    out = aggregate_step_evaluations(
        [
            _eval(
                session_id="s-1",
                from_step=2,
                evaluated_at="2026-05-18T10:00:00+00:00",
            ),
            _eval(
                session_id="s-1",
                from_step=3,
                evaluated_at="2026-05-18T10:00:00+00:00",
            ),
        ]
    )
    assert out["time_seconds_per_step"] == {}


def test_time_seconds_per_step_reorders_out_of_order_input():
    """Rows arrive with the older timestamp SECOND. The aggregator
    sorts internally, so the gap is computed correctly as 60s on
    the earlier step (not nonsense / negative)."""
    out = aggregate_step_evaluations(
        [
            _eval(
                session_id="s-1",
                from_step=3,
                evaluated_at="2026-05-18T10:01:00+00:00",
            ),
            _eval(
                session_id="s-1",
                from_step=2,
                evaluated_at="2026-05-18T10:00:00+00:00",
            ),
        ]
    )
    # After sort: step 2 @ 10:00 → step 3 @ 10:01. Gap 60s on
    # step 2 (the prev.from_step at the start of the gap).
    assert out["time_seconds_per_step"] == {2: 60.0}


def test_unparseable_timestamps_drop_silently():
    out = aggregate_step_evaluations(
        [
            _eval(session_id="s-1", evaluated_at="not-a-date"),
            _eval(session_id="s-1", evaluated_at="2026-05-18T10:00:00+00:00"),
        ]
    )
    # No valid gap pair → no time aggregated.
    assert out["time_seconds_per_step"] == {}
    # But counts are unaffected.
    assert out["total_evaluations"] == 2


def test_handles_iso_with_trailing_z():
    """``2026-05-18T10:00:00Z`` (UTC-Z shorthand) is accepted."""
    out = aggregate_step_evaluations(
        [
            _eval(session_id="s-1", from_step=2, evaluated_at="2026-05-18T10:00:00Z"),
            _eval(session_id="s-1", from_step=3, evaluated_at="2026-05-18T10:00:30Z"),
        ]
    )
    assert out["time_seconds_per_step"] == {2: 30.0}


def test_non_string_session_id_does_not_crash():
    """Defensive: malformed row with session_id=None is ignored
    for time aggregation but still counts toward totals."""
    out = aggregate_step_evaluations(
        [
            {
                "id": "e-1",
                "session_id": None,
                "from_step": 1,
                "to_step": 2,
                "advance": True,
                "applied": True,
                "fallback_used": False,
                "confidence": 0.8,
                "reason": "",
                "evaluated_at": "2026-05-18T10:00:00+00:00",
            }
        ]
    )
    assert out["total_evaluations"] == 1
    assert out["average_confidence"] == 0.8
    assert out["time_seconds_per_step"] == {}
