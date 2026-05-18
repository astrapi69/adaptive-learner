"""Tests for the stagnation-based method-switch recommendation."""

from __future__ import annotations

from adaptive_learner_session.switching import (
    STAGNATION_WINDOW,
    STRESS_THRESHOLD,
    _is_stagnant,
    _next_method,
    recommend,
)

# --- Window threshold ------------------------------------------------------


def test_returns_none_when_window_too_short():
    """Fewer than 3 ratings = not enough signal."""
    ratings = [
        {"understanding": 3, "stress": 5},
        {"understanding": 3, "stress": 5},
    ]
    assert recommend("p1", "deductive", ratings) is None


def test_returns_none_when_understanding_improves():
    ratings = [
        {"understanding": 2, "stress": 5},
        {"understanding": 3, "stress": 5},
        {"understanding": 4, "stress": 5},
    ]
    assert recommend("p1", "deductive", ratings) is None


def test_returns_none_when_stress_below_threshold():
    ratings = [
        {"understanding": 3, "stress": 2},
        {"understanding": 3, "stress": 2},
        {"understanding": 3, "stress": 2},
    ]
    assert recommend("p1", "deductive", ratings) is None


# --- Recommendation fires --------------------------------------------------


def test_recommends_switch_when_stagnant_and_stressed():
    ratings = [
        {"understanding": 3, "stress": 5},
        {"understanding": 3, "stress": 4},
        {"understanding": 3, "stress": 5},
    ]
    rec = recommend("p1", "deductive", ratings)
    assert rec is not None
    assert rec["project_id"] == "p1"
    assert rec["from_method"] == "deductive"
    assert rec["to_method"] != "deductive"
    assert "stress" in rec["reason"].lower() or "flat" in rec["reason"].lower()
    assert 0 <= rec["confidence"] <= 1


def test_confidence_higher_under_severe_stress():
    high = [{"understanding": 3, "stress": 5}] * 3
    mid = [{"understanding": 3, "stress": 4}] * 3
    rec_high = recommend("p1", "deductive", high)
    rec_mid = recommend("p1", "deductive", mid)
    assert rec_high is not None and rec_mid is not None
    assert rec_high["confidence"] >= rec_mid["confidence"]


def test_decreasing_understanding_counts_as_stagnant():
    ratings = [
        {"understanding": 4, "stress": 5},
        {"understanding": 3, "stress": 5},
        {"understanding": 2, "stress": 5},
    ]
    rec = recommend("p1", "deductive", ratings)
    assert rec is not None


def test_only_last_window_matters():
    """Earlier good ratings don't excuse a stagnant + stressed
    recent window."""
    ratings = [
        # Older: improving + low stress (don't count)
        {"understanding": 2, "stress": 1},
        {"understanding": 3, "stress": 1},
        {"understanding": 5, "stress": 1},
        # Recent window: stagnant + stressed
        {"understanding": 3, "stress": 5},
        {"understanding": 3, "stress": 5},
        {"understanding": 3, "stress": 5},
    ]
    rec = recommend("p1", "deductive", ratings)
    assert rec is not None


# --- Next-method selection -------------------------------------------------


def test_next_method_prefers_highest_unused_profile_weight():
    """With a profile, pick the highest-weighted method that isn't
    current."""
    profile = {
        "deductive": 0.9,  # current
        "inductive": 0.3,
        "error_based": 0.7,  # highest non-current
        "dialogic": 0.1,
        "contextual": 0.4,
        "ai_adaptive": 0.2,
    }
    assert _next_method("deductive", profile, ["deductive"]) == "error_based"


def test_next_method_avoids_recently_used():
    profile = {
        "deductive": 0.9,
        "error_based": 0.7,
        "inductive": 0.5,
        "dialogic": 0.3,
        "contextual": 0.2,
        "ai_adaptive": 0.1,
    }
    # current = deductive, recently used = [deductive, error_based]
    out = _next_method("deductive", profile, ["deductive", "error_based"])
    assert out == "inductive"


def test_next_method_falls_back_to_static_order_when_no_profile():
    out = _next_method("deductive", None, ["deductive"])
    # Static METHODS order, skipping deductive
    assert out == "inductive"


def test_next_method_returns_any_non_current_when_skipset_full():
    # Recently used = every method except current
    used = [
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    ]
    out = _next_method("deductive", None, used)
    # The static-order pass returns None; the final fallback returns
    # any non-current — at minimum the first non-deductive method.
    assert out != "deductive"
    assert out is not None


# --- Recommendation passes profile through --------------------------------


def test_recommend_uses_profile_when_supplied():
    ratings = [{"understanding": 3, "stress": 5}] * 3
    profile = {
        "deductive": 0.5,  # current
        "inductive": 0.1,
        "error_based": 0.4,
        "dialogic": 0.9,  # highest non-current
        "contextual": 0.2,
        "ai_adaptive": 0.3,
    }
    rec = recommend("p1", "deductive", ratings, profile=profile)
    assert rec is not None
    assert rec["to_method"] == "dialogic"


def test_recommend_avoids_methods_in_recently_used():
    ratings = [{"understanding": 3, "stress": 5}] * 3
    rec = recommend(
        "p1",
        "deductive",
        ratings,
        recently_used_methods=["deductive", "inductive"],
    )
    assert rec is not None
    assert rec["to_method"] != "deductive"
    assert rec["to_method"] != "inductive"


# --- _is_stagnant directly -------------------------------------------------


def test_is_stagnant_too_short_returns_false():
    assert not _is_stagnant([3, 3])


def test_is_stagnant_flat_returns_true():
    assert _is_stagnant([3, 3, 3])


def test_is_stagnant_increasing_returns_false():
    assert not _is_stagnant([2, 3, 4])


def test_is_stagnant_first_higher_then_dip_then_recover():
    """[3, 2, 3]: max(3) - first(3) = 0 -> stagnant."""
    assert _is_stagnant([3, 2, 3])


def test_constants_pinned():
    assert STAGNATION_WINDOW == 3
    assert STRESS_THRESHOLD == 3.0
