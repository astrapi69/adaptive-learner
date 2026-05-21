"""Pure-unit tests for the XP calculator (no DB).

The persistence wrappers (``award_xp_for_session``,
``award_xp_flat``, ``get_user_xp_state``) are tested in
``backend/tests/test_gamification_plugin_integration.py`` where
the in-memory SQLite fixture is available.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from adaptive_learner_gamification.xp_service import (
    XPAward,
    calculate_session_xp,
    compute_level,
    current_streak_days,
    level_threshold,
)


# --- Level curve -----------------------------------------------------------


def test_level_threshold_curve() -> None:
    """Threshold table pinned to the spec example: 0/100/300/600/1000."""
    assert level_threshold(1) == 0
    assert level_threshold(2) == 100
    assert level_threshold(3) == 300
    assert level_threshold(4) == 600
    assert level_threshold(5) == 1000
    assert level_threshold(6) == 1500


def test_level_threshold_below_one_is_zero() -> None:
    assert level_threshold(0) == 0
    assert level_threshold(-5) == 0


def test_compute_level_at_thresholds() -> None:
    assert compute_level(0) == 1
    assert compute_level(99) == 1
    assert compute_level(100) == 2
    assert compute_level(299) == 2
    assert compute_level(300) == 3
    assert compute_level(1000) == 5


def test_compute_level_negative_xp_clamps_to_one() -> None:
    assert compute_level(-50) == 1


def test_compute_level_walks_far_levels() -> None:
    # At 50_000 XP the spec curve puts the user well past level 30.
    assert compute_level(50_000) >= 30


# --- Streak helpers --------------------------------------------------------


def test_current_streak_days_no_activity_today_is_zero() -> None:
    today = date(2026, 5, 21)
    yesterday = today - timedelta(days=1)
    assert current_streak_days({yesterday}, today) == 0


def test_current_streak_days_three_consecutive() -> None:
    today = date(2026, 5, 21)
    days = {today, today - timedelta(days=1), today - timedelta(days=2)}
    assert current_streak_days(days, today) == 3


def test_current_streak_days_breaks_on_gap() -> None:
    today = date(2026, 5, 21)
    days = {today, today - timedelta(days=1), today - timedelta(days=3)}
    # gap on day-2 stops the count at 2
    assert current_streak_days(days, today) == 2


def test_current_streak_days_default_today_is_utc_today() -> None:
    # Calling without ``today`` shouldn't crash — function uses
    # the current UTC date. Pass an empty set so the result is 0.
    assert current_streak_days(set()) == 0


# --- Session XP calculator -------------------------------------------------


def test_session_xp_minimum_award_is_base() -> None:
    award = calculate_session_xp(
        cycle_step=3,
        cycle_count=1,
        streak_days=0,
        is_first_method_session=False,
    )
    # Base 50, no completed cycles, no bonus, multiplier 1.0
    assert award.xp_earned == 50
    assert award.breakdown == {"base": 50}
    assert award.multiplier == 1.0
    assert award.reason == "session_complete"


def test_session_xp_completes_cycle_at_step_seven() -> None:
    award = calculate_session_xp(
        cycle_step=7,
        cycle_count=1,
        streak_days=0,
        is_first_method_session=False,
    )
    # Base 50 + cycle 10 + seven-step 25 = 85
    assert award.xp_earned == 85
    assert award.breakdown["cycle_bonus"] == 10
    assert award.breakdown["seven_step_bonus"] == 25


def test_session_xp_multi_cycle_counts_prior_cycles() -> None:
    """cycle_count=3, cycle_step=7 means 2 completed cycles + current ended at 7."""
    award = calculate_session_xp(
        cycle_step=7,
        cycle_count=3,
        streak_days=0,
        is_first_method_session=False,
    )
    # 3 completed cycles: base 50 + 10*3 + 25*3 = 50 + 30 + 75 = 155
    assert award.xp_earned == 155


def test_session_xp_first_method_bonus() -> None:
    award = calculate_session_xp(
        cycle_step=3,
        cycle_count=1,
        streak_days=0,
        is_first_method_session=True,
    )
    # 50 + 50 = 100
    assert award.xp_earned == 100
    assert award.breakdown["first_method_bonus"] == 50


def test_session_xp_streak_multiplier_caps_at_seven_days() -> None:
    """+25% per day, capped at 7 days (2.75x)."""
    one_day = calculate_session_xp(
        cycle_step=3,
        cycle_count=1,
        streak_days=1,
        is_first_method_session=False,
    )
    seven = calculate_session_xp(
        cycle_step=3,
        cycle_count=1,
        streak_days=7,
        is_first_method_session=False,
    )
    twenty = calculate_session_xp(
        cycle_step=3,
        cycle_count=1,
        streak_days=20,
        is_first_method_session=False,
    )
    # 1 day: 50 * 1.25 = 62.5 -> 63 (banker's round)
    assert one_day.xp_earned in (62, 63)
    assert one_day.multiplier == pytest.approx(1.25)
    # 7 days: 50 * 2.75 = 137.5 -> 138
    assert seven.xp_earned in (137, 138)
    assert seven.multiplier == pytest.approx(2.75)
    # 20 days caps at the 7-day multiplier
    assert twenty.xp_earned == seven.xp_earned
    assert twenty.multiplier == seven.multiplier


def test_session_xp_breakdown_records_streak_pct() -> None:
    award = calculate_session_xp(
        cycle_step=3,
        cycle_count=1,
        streak_days=4,
        is_first_method_session=False,
    )
    # +100% at 4 days (4 * 25)
    assert award.breakdown["streak_multiplier_pct"] == 100


def test_session_xp_award_dataclass_to_dict_roundtrip() -> None:
    award = XPAward(
        xp_earned=50,
        xp_total=50,
        level=1,
        level_up=False,
        multiplier=1.0,
        breakdown={"base": 50},
        reason="test",
    )
    d = award.to_dict()
    assert d["xp_earned"] == 50
    assert d["breakdown"] == {"base": 50}
    assert d["reason"] == "test"
