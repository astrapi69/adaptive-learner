"""Unit tests for the v0.4.0 spaced-repetition recommendation
builder. The module is a pure function; tests do not touch the
DB or FastAPI."""

from __future__ import annotations

from adaptive_learner_tools.spaced_recommendations import (
    build_spaced_recommendations,
    localise,
)


def _strong_deductive_only() -> dict[str, float]:
    return {
        "deductive": 0.8,
        "inductive": 0.0,
        "error_based": 0.0,
        "dialogic": 0.0,
        "contextual": 0.0,
        "ai_adaptive": 0.0,
    }


def test_skips_methods_with_zero_weight():
    """Only methods with weight > 0 produce cards."""
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": None},
    )
    assert len(cards) == 1
    assert cards[0]["method"] == "deductive"


def test_no_commits_yields_first_practice_band():
    """``recency=None`` -> ``first`` band, interval_days=1."""
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": None},
    )
    card = cards[0]
    assert card["id"] == "sr-deductive-first"
    assert card["interval_days"] == 1
    assert card["action"] == "session"
    # German title carries the localised method label.
    assert "Deduktion" in card["title_de"]
    assert "deduction" in card["title_en"]


def test_refresh_band_kicks_in_above_14_days():
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": 15.0},
    )
    assert cards[0]["id"] == "sr-deductive-refresh"
    assert cards[0]["interval_days"] == 1


def test_review_band_between_7_and_14_days():
    """The lower boundary (7 days) is inclusive."""
    for days in (7.0, 10.0, 13.99):
        cards = build_spaced_recommendations(
            _strong_deductive_only(),
            recency={"deductive": days},
        )
        assert cards[0]["id"] == "sr-deductive-review"
        assert cards[0]["interval_days"] == 3


def test_practice_band_between_3_and_7_days():
    for days in (3.0, 5.0, 6.99):
        cards = build_spaced_recommendations(
            _strong_deductive_only(),
            recency={"deductive": days},
        )
        assert cards[0]["id"] == "sr-deductive-practice"
        assert cards[0]["interval_days"] == 7


def test_maintain_band_under_3_days():
    for days in (0.0, 1.5, 2.99):
        cards = build_spaced_recommendations(
            _strong_deductive_only(),
            recency={"deductive": days},
        )
        assert cards[0]["id"] == "sr-deductive-maintain"
        assert cards[0]["interval_days"] == 14


def test_urgency_orders_shorter_intervals_first():
    """A method with no commits (interval=1) outranks one with a
    recent commit (interval=14) regardless of weight."""
    profile = {
        "deductive": 0.3,
        "inductive": 0.9,  # stronger, but recently practised
        "error_based": 0.0,
        "dialogic": 0.0,
        "contextual": 0.0,
        "ai_adaptive": 0.0,
    }
    recency = {
        "deductive": None,  # band=first, interval=1
        "inductive": 1.0,  # band=maintain, interval=14
    }
    cards = build_spaced_recommendations(profile, recency)
    assert [c["method"] for c in cards] == ["deductive", "inductive"]


def test_urgency_breaks_ties_by_higher_weight():
    """At the same interval band, the stronger method surfaces
    first (lower urgency value)."""
    profile = {
        "deductive": 0.3,
        "inductive": 0.8,
        "error_based": 0.0,
        "dialogic": 0.0,
        "contextual": 0.0,
        "ai_adaptive": 0.0,
    }
    # Both methods land in the same band (review, interval=3).
    recency = {
        "deductive": 7.0,
        "inductive": 7.0,
    }
    cards = build_spaced_recommendations(profile, recency)
    assert [c["method"] for c in cards] == ["inductive", "deductive"]


def test_limit_caps_output_length():
    profile = dict.fromkeys(
        [
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
        ],
        0.5,
    )
    recency = dict.fromkeys(profile, None)
    cards = build_spaced_recommendations(profile, recency, limit=3)
    assert len(cards) == 3


def test_stable_ids_match_method_and_kind():
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": None},
    )
    assert cards[0]["id"] == "sr-deductive-first"
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": 15.0},
    )
    assert cards[0]["id"] == "sr-deductive-refresh"


def test_localise_picks_de_for_de_lang():
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": None},
    )
    wire = localise(cards[0], "de")
    assert wire["title"] == cards[0]["title_de"]
    assert "title_de" not in wire and "title_en" not in wire


def test_localise_picks_en_for_anything_non_de():
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": None},
    )
    for lang in ("en", "fr", "ja", ""):
        wire = localise(cards[0], lang)
        assert wire["title"] == cards[0]["title_en"]


def test_localise_preserves_card_keys():
    cards = build_spaced_recommendations(
        _strong_deductive_only(),
        recency={"deductive": None},
    )
    wire = localise(cards[0], "en")
    assert set(wire.keys()) == {
        "id",
        "method",
        "interval_days",
        "action",
        "title",
        "urgency",
    }


def test_empty_profile_yields_no_cards():
    cards = build_spaced_recommendations(
        profile={},
        recency={},
    )
    assert cards == []
