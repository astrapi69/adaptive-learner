"""Tests for the prompt-composition module."""

from __future__ import annotations

import pytest
from adaptive_learner_session.prompts import (
    _METHOD_CORES,
    _STEP_MODIFIERS,
    MAX_STEP,
    METHODS,
    MIN_STEP,
    STEP_RANGE,
    _dominant_method,
    build_prompt,
)

# --- Coverage matrix -------------------------------------------------------


def test_method_cores_cover_all_six_methods():
    assert set(_METHOD_CORES.keys()) == set(METHODS)


def test_step_modifiers_cover_seven_steps():
    assert set(_STEP_MODIFIERS.keys()) == set(STEP_RANGE)
    assert len(STEP_RANGE) == 7


@pytest.mark.parametrize("method", METHODS)
def test_every_method_has_de_and_en_core(method):
    cores = _METHOD_CORES[method]
    assert cores.get("de") and isinstance(cores["de"], str)
    assert cores.get("en") and isinstance(cores["en"], str)


@pytest.mark.parametrize("step", STEP_RANGE)
def test_every_step_has_de_and_en_modifier(step):
    mods = _STEP_MODIFIERS[step]
    assert mods.get("de") and isinstance(mods["de"], str)
    assert mods.get("en") and isinstance(mods["en"], str)


# --- _dominant_method ------------------------------------------------------


def test_dominant_method_picks_highest_weight():
    profile = {
        "deductive": 0.1,
        "inductive": 0.7,
        "error_based": 0.2,
        "dialogic": 0.3,
        "contextual": 0.4,
        "ai_adaptive": 0.5,
    }
    assert _dominant_method(profile) == "inductive"


def test_dominant_method_alphabetical_tiebreak():
    """All-equal weights: ``max(sorted(...), key=...)`` keeps the
    first candidate it sees on ties (max replaces only on strictly
    greater), so the alphabetically FIRST method wins.
    """
    profile = {m: 1.0 for m in METHODS}
    assert _dominant_method(profile) == sorted(METHODS)[0]
    assert _dominant_method(profile) == "ai_adaptive"


def test_dominant_method_returns_none_when_profile_empty():
    assert _dominant_method({}) is None


def test_dominant_method_ignores_non_numeric():
    profile = {"deductive": "not a number", "inductive": 0.5}
    assert _dominant_method(profile) == "inductive"


# --- build_prompt happy path -----------------------------------------------


def _project_fixture() -> dict:
    return {"topic": "Python", "goal": "Master classes."}


def _profile_fixture() -> dict:
    return {
        "deductive": 0.8,
        "inductive": 0.1,
        "error_based": 0.1,
        "dialogic": 0.0,
        "contextual": 0.0,
        "ai_adaptive": 0.0,
    }


@pytest.mark.parametrize("method", METHODS)
def test_build_prompt_contains_method_core_for_each_method(method):
    out = build_prompt(_project_fixture(), _profile_fixture(), method, 1, "de")
    assert _METHOD_CORES[method]["de"] in out


@pytest.mark.parametrize("step", STEP_RANGE)
def test_build_prompt_contains_step_modifier_for_each_step(step):
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", step, "de")
    assert _STEP_MODIFIERS[step]["de"] in out


def test_build_prompt_injects_project_topic_and_goal_de():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    assert "'Python'" in out
    assert "'Master classes.'" in out


def test_build_prompt_injects_project_topic_and_goal_en():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "en")
    assert "'Python'" in out
    assert "'Master classes.'" in out


def test_build_prompt_uses_german_text_for_de():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    # The German core for deductive contains "Regel" — the EN version
    # contains "rule" lowercased.
    assert "Regel" in out
    assert "Lernprojekt" in out


def test_build_prompt_uses_english_text_for_en():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "en")
    assert "rule" in out
    assert "Learning project" in out


@pytest.mark.parametrize("lang", ["fr", "ja", "", "es"])
def test_unknown_language_falls_back_to_en(lang: str):
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, lang)
    assert "Learning project" in out


def test_regional_de_dialect_is_accepted():
    out_de = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    out_at = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de-AT")
    assert out_de == out_at


def test_build_prompt_includes_dominant_method_hint():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    assert "deductive" in out
    assert "0.8" in out


def test_build_prompt_omits_profile_hint_when_profile_empty():
    out = build_prompt(_project_fixture(), {}, "deductive", 1, "de")
    assert "Profil-Hinweis" not in out


# --- build_prompt validation ----------------------------------------------


def test_build_prompt_rejects_unknown_method():
    with pytest.raises(ValueError, match="Unknown method"):
        build_prompt(_project_fixture(), _profile_fixture(), "telekinesis", 1, "de")


@pytest.mark.parametrize("bad_step", [0, MAX_STEP + 1, -1, MIN_STEP - 1, "not int", None])
def test_build_prompt_rejects_out_of_range_step(bad_step):
    with pytest.raises(ValueError):
        build_prompt(
            _project_fixture(),
            _profile_fixture(),
            "deductive",
            bad_step,  # type: ignore[arg-type]
            "de",
        )


def test_build_prompt_handles_missing_topic_and_goal():
    out = build_prompt({}, {}, "deductive", 1, "de")
    assert "'?'" in out  # placeholder for both missing fields


# --- Output shape ----------------------------------------------------------


def test_output_is_non_empty_string():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    assert isinstance(out, str)
    assert len(out) > 0


def test_output_separates_sections_with_blank_lines():
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    assert "\n\n" in out
