"""Tests for the static tool catalogue + ranking."""

from __future__ import annotations

import pytest
from adaptive_learner_tools.catalogue import (
    DEFAULT_LIMIT,
    METHODS,
    TOOLS,
    _score,
    rank_tools,
)

# --- Catalogue shape -------------------------------------------------------


def test_catalogue_is_non_empty():
    assert len(TOOLS) >= 3


def test_baseline_three_are_present():
    """Project-reference §3.4 names Anki, NotebookLM, and an
    adaptive AI prompt as the v0.1.0 baseline."""
    names = {t["name"] for t in TOOLS}
    assert "Anki" in names
    assert "NotebookLM" in names
    assert any("AI" in n for n in names)


@pytest.mark.parametrize("tool", TOOLS, ids=lambda t: t["name"])
def test_every_tool_has_required_keys(tool):
    for key in ("name", "url", "why_de", "why_en", "weight_keys"):
        assert key in tool, f"{tool['name']} is missing {key!r}"


@pytest.mark.parametrize("tool", TOOLS, ids=lambda t: t["name"])
def test_every_tool_url_is_https(tool):
    assert tool["url"].startswith("https://")


@pytest.mark.parametrize("tool", TOOLS, ids=lambda t: t["name"])
def test_every_tool_weight_keys_are_known_methods(tool):
    assert tool["weight_keys"], f"{tool['name']} has empty weight_keys"
    for key in tool["weight_keys"]:
        assert key in METHODS, f"{tool['name']}: unknown method {key!r}"


@pytest.mark.parametrize("tool", TOOLS, ids=lambda t: t["name"])
def test_every_tool_has_de_and_en_text(tool):
    assert tool["why_de"] and isinstance(tool["why_de"], str)
    assert tool["why_en"] and isinstance(tool["why_en"], str)


def test_every_method_is_served_by_at_least_one_tool():
    served: set[str] = set()
    for tool in TOOLS:
        served.update(tool["weight_keys"])
    assert served == set(METHODS), f"Methods unserved: {set(METHODS) - served}"


# --- _score ---------------------------------------------------------------


def test_score_sums_profile_weights_across_keys():
    tool = {"weight_keys": ["deductive", "error_based"]}
    profile = {"deductive": 0.6, "error_based": 0.4, "dialogic": 0.9}
    # Sum of the two referenced weights; dialogic ignored.
    assert _score(tool, profile) == pytest.approx(1.0)  # type: ignore[arg-type]


def test_score_skips_non_numeric_weights():
    tool = {"weight_keys": ["deductive", "inductive"]}
    profile = {"deductive": "not a number", "inductive": 0.5}
    assert _score(tool, profile) == 0.5  # type: ignore[arg-type]


def test_score_returns_zero_on_empty_profile():
    tool = {"weight_keys": ["deductive"]}
    assert _score(tool, {}) == 0.0  # type: ignore[arg-type]


# --- rank_tools happy path ------------------------------------------------


def _purely(method: str) -> dict:
    return {m: (1.0 if m == method else 0.0) for m in METHODS}


def test_rank_returns_list_of_at_most_limit():
    out = rank_tools(_purely("deductive"), "de")
    assert len(out) <= DEFAULT_LIMIT


def test_rank_returns_localised_text_de():
    out = rank_tools(_purely("deductive"), "de")
    assert all("why" in r for r in out)
    # German fixture: contains an Umlaut-style fragment or German
    # word. We assert non-empty + presence of one German signal.
    assert any("ideal" in r["why"].lower() or "passt" in r["why"].lower() for r in out)


def test_rank_returns_localised_text_en():
    out = rank_tools(_purely("deductive"), "en")
    assert any("spaced" in r["why"].lower() or "great" in r["why"].lower() for r in out)


@pytest.mark.parametrize("lang", ["fr", "ja", "", "es"])
def test_unknown_language_falls_back_to_english(lang: str):
    out_en = rank_tools(_purely("deductive"), "en")
    out_fallback = rank_tools(_purely("deductive"), lang)
    assert [r["why"] for r in out_en] == [r["why"] for r in out_fallback]


def test_rank_respects_custom_limit():
    out = rank_tools(_purely("deductive"), "de", limit=2)
    assert len(out) == 2


def test_rank_sorts_by_score_descending():
    out = rank_tools(_purely("deductive"), "de")
    scores = [r["score"] for r in out]
    assert scores == sorted(scores, reverse=True)


def test_deductive_user_sees_deductive_tool_first():
    out = rank_tools(_purely("deductive"), "de")
    # Anki has weight_keys = ["deductive", "error_based"] — should
    # rank above tools that don't include deductive.
    top = out[0]
    assert "deductive" in top["weight_keys"]


def test_ai_adaptive_user_sees_ai_tool_first():
    out = rank_tools(_purely("ai_adaptive"), "de")
    # "Adaptive AI Prompt" has weight_keys = ["ai_adaptive", "dialogic"].
    assert out[0]["name"] == "Adaptive AI Prompt"


def test_empty_profile_keeps_catalogue_authored_order():
    """All-zero scores → stable sort keeps authored ranking."""
    out = rank_tools({}, "de")
    authored_names = [t["name"] for t in TOOLS][: len(out)]
    assert [r["name"] for r in out] == authored_names


def test_rank_output_does_not_leak_internal_keys():
    out = rank_tools(_purely("deductive"), "de")
    for r in out:
        assert "why_de" not in r
        assert "why_en" not in r


def test_score_field_rounded_to_4_decimals():
    out = rank_tools({"deductive": 0.123456789, "error_based": 0.987654321}, "de")
    for r in out:
        assert round(r["score"], 4) == r["score"]
