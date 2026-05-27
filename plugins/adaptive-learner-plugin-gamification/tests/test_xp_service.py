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
    calculate_lesson_session_xp,
    calculate_session_xp,
    compute_level,
    compute_stars,
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


# --- Lesson XP calculator (Phase 46E.1 / v1.31.0) -------------------------


@pytest.mark.parametrize(
    "correct, total, expected_stars",
    [
        (0, 10, 0),       # 0% → 0
        (4, 10, 0),       # 40% → 0
        (5, 10, 1),       # exactly 50% → 1
        (7, 10, 1),       # 70% → 1
        (75, 100, 2),     # exactly 75% → 2
        (89, 100, 2),     # 89% → 2
        (9, 10, 3),       # exactly 90% → 3
        (10, 10, 3),      # 100% → 3
        (0, 0, 0),        # zero-total guard → 0
        (4, 4, 3),        # small denominator at 100%
    ],
)
def test_compute_stars_band_edges(correct, total, expected_stars) -> None:
    assert compute_stars(correct, total) == expected_stars


def test_lesson_xp_zero_stars_no_first_attempt_streak_zero() -> None:
    award = calculate_lesson_session_xp(
        stars=0,
        first_attempt=False,
        streak_days=0,
    )
    assert award.xp_earned == 30
    assert award.breakdown == {"base": 30}
    assert award.multiplier == 1.0
    assert award.reason == "lesson_complete"


def test_lesson_xp_stars_add_ten_each() -> None:
    one = calculate_lesson_session_xp(
        stars=1, first_attempt=False, streak_days=0
    )
    two = calculate_lesson_session_xp(
        stars=2, first_attempt=False, streak_days=0
    )
    three = calculate_lesson_session_xp(
        stars=3, first_attempt=False, streak_days=0
    )
    assert one.xp_earned == 40   # 30 + 10
    assert two.xp_earned == 50   # 30 + 20
    assert three.xp_earned == 60  # 30 + 30
    assert one.breakdown["star_bonus"] == 10
    assert two.breakdown["star_bonus"] == 20
    assert three.breakdown["star_bonus"] == 30


def test_lesson_xp_first_attempt_three_star_bonus() -> None:
    award = calculate_lesson_session_xp(
        stars=3, first_attempt=True, streak_days=0
    )
    # 30 base + 30 star + 20 first-attempt-3-star = 80
    assert award.xp_earned == 80
    assert award.breakdown["first_attempt_3star_bonus"] == 20


def test_lesson_xp_first_attempt_two_star_no_bonus() -> None:
    """First-attempt bonus is gated on 3 stars — not awarded for 2."""
    award = calculate_lesson_session_xp(
        stars=2, first_attempt=True, streak_days=0
    )
    # 30 + 20 = 50; NO first_attempt_3star_bonus key
    assert award.xp_earned == 50
    assert "first_attempt_3star_bonus" not in award.breakdown


def test_lesson_xp_three_star_no_first_attempt_no_bonus() -> None:
    """The bonus needs BOTH conditions — 3 stars without first attempt = no bonus."""
    award = calculate_lesson_session_xp(
        stars=3, first_attempt=False, streak_days=0
    )
    # 30 + 30 = 60; NO first_attempt_3star_bonus key
    assert award.xp_earned == 60
    assert "first_attempt_3star_bonus" not in award.breakdown


def test_lesson_xp_streak_multiplier_matches_session_formula() -> None:
    """+25%/day capped at 7. Same shape as the chat-session formula."""
    one_day = calculate_lesson_session_xp(
        stars=3, first_attempt=True, streak_days=1
    )
    seven = calculate_lesson_session_xp(
        stars=3, first_attempt=True, streak_days=7
    )
    twenty = calculate_lesson_session_xp(
        stars=3, first_attempt=True, streak_days=20
    )
    # Base 80, +25% = 100
    assert one_day.xp_earned == 100
    assert one_day.multiplier == pytest.approx(1.25)
    # Base 80, +175% = 220
    assert seven.xp_earned == 220
    assert seven.multiplier == pytest.approx(2.75)
    # 20 days clamped to 7
    assert twenty.xp_earned == seven.xp_earned


def test_lesson_xp_stars_clamped_above_three() -> None:
    """Defensive: stars >= 3 are clamped to 3 (no infinite bonus)."""
    award = calculate_lesson_session_xp(
        stars=99, first_attempt=False, streak_days=0
    )
    # Clamps to 3 stars → 30 + 30 = 60 (no first_attempt bonus
    # because the bonus also requires first_attempt=True)
    assert award.xp_earned == 60
    assert award.breakdown["star_bonus"] == 30


def test_lesson_xp_stars_clamped_below_zero() -> None:
    """Defensive: negative stars clamp to 0."""
    award = calculate_lesson_session_xp(
        stars=-5, first_attempt=False, streak_days=0
    )
    assert award.xp_earned == 30
    assert award.breakdown == {"base": 30}


def test_lesson_xp_breakdown_records_streak_pct() -> None:
    award = calculate_lesson_session_xp(
        stars=2, first_attempt=False, streak_days=4
    )
    # 30 + 20 = 50; +100% (4 * 25) = 100
    assert award.xp_earned == 100
    assert award.breakdown["streak_multiplier_pct"] == 100
