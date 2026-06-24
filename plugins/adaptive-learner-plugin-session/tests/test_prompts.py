"""Tests for the prompt-composition module.

Phase 6A: the 42-cell matrix (6 methods × 7 steps) replaces the
v0.1.0-v0.2.0 core+modifier overlay. Tests pin:

- Every (method, step) cell is present, in both DE and EN.
- Each cell's text actually reaches the composed prompt.
- The project + profile context block stays intact.
- Validation (unknown method, out-of-range step) keeps raising
  ValueError so the route layer can translate to HTTP 400.
"""

from __future__ import annotations

import pytest
from adaptive_learner_session.prompts import (
    _PROMPTS,
    MAX_STEP,
    METHODS,
    MIN_STEP,
    STEP_RANGE,
    CompletedLesson,
    InProgressLesson,
    LearningContext,
    ConversationTurn,
    RecentMistake,
    _dominant_method,
    build_analysis_context,
    build_conversation_context,
    build_language_directive,
    build_learning_context,
    build_prompt,
)

# --- Coverage matrix -------------------------------------------------------


def test_prompts_cover_all_six_methods():
    assert set(_PROMPTS.keys()) == set(METHODS)


def test_prompts_cover_seven_steps_per_method():
    """Every method's inner dict must have entries for steps 1..7
    — no holes in the 6×7 matrix."""
    for method in METHODS:
        assert set(_PROMPTS[method].keys()) == set(STEP_RANGE)
        assert len(STEP_RANGE) == 7


@pytest.mark.parametrize("method", METHODS)
@pytest.mark.parametrize("step", list(range(1, 8)))
def test_every_cell_has_de_and_en(method: str, step: int):
    """All 42 cells × 2 languages = 84 non-empty strings."""
    cell = _PROMPTS[method][step]
    de_text = cell.get("de")
    en_text = cell.get("en")
    assert isinstance(de_text, str) and de_text.strip()
    assert isinstance(en_text, str) and en_text.strip()


def test_cells_are_distinct_per_step_within_a_method():
    """Each step's prompt is bespoke — no two steps of the same
    method should be identical. Catches a future copy-paste
    regression that leaves a method's matrix half-filled."""
    for method in METHODS:
        de_texts = {step: _PROMPTS[method][step]["de"] for step in STEP_RANGE}
        assert len(set(de_texts.values())) == 7, (
            f"method {method!r} has duplicate cells across steps"
        )


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
def test_build_prompt_contains_cell_text_for_each_method_at_step_1(method):
    out = build_prompt(_project_fixture(), _profile_fixture(), method, 1, "de")
    assert _PROMPTS[method][1]["de"] in out


@pytest.mark.parametrize("step", STEP_RANGE)
def test_build_prompt_contains_cell_text_for_each_step_under_deductive(step):
    out = build_prompt(_project_fixture(), _profile_fixture(), "deductive", step, "de")
    assert _PROMPTS["deductive"][step]["de"] in out


def test_build_prompt_uses_step_specific_text_not_step_1_for_step_4():
    """Regression pin against a future bug where build_prompt
    silently ignores the step argument and always uses step 1.
    The deductive-step-4 cell talks about correction; the
    deductive-step-1 cell talks about rule statement — distinct
    strings."""
    out_step_1 = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 1, "de")
    out_step_4 = build_prompt(_project_fixture(), _profile_fixture(), "deductive", 4, "de")
    assert _PROMPTS["deductive"][1]["de"] in out_step_1
    assert _PROMPTS["deductive"][1]["de"] not in out_step_4
    assert _PROMPTS["deductive"][4]["de"] in out_step_4


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
    # The German cell for (deductive, 1) contains "Regel" —
    # English equivalent contains "rule".
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


# --- Analysis context (continue-session-after-import fix) -------------------


def _analysis_fixture() -> dict:
    return {
        "topic": "Spanish past tense",
        "summary": "The learner practised the preterite.",
        "user_level": "intermediate",
        "strengths": ["vocabulary recall"],
        "weaknesses": ["irregular verbs"],
        "error_patterns": ["confuses ser/estar"],
        "vocabulary": [
            {"word": "tener", "translation": "to have"},
            {"word": "hacer", "translation": "to do"},
        ],
        "suggested_curriculum": [{"title": "Irregular preterite drill", "priority": 1}],
    }


def test_analysis_context_de_includes_every_field():
    out = build_analysis_context(_analysis_fixture(), "de")
    assert "Spanish past tense" in out
    assert "Zusammenfassung:" in out
    assert "Niveau: intermediate" in out
    assert "Stärken: vocabulary recall" in out
    assert "Schwächen: irregular verbs" in out
    assert "Fehlermuster: confuses ser/estar" in out
    assert "tener" in out and "hacer" in out
    assert "Irregular preterite drill" in out
    # Closing instruction tells the AI to continue + reference the analysis.
    assert "Setze die Lernsitzung fort" in out


def test_analysis_context_en_includes_every_field():
    out = build_analysis_context(_analysis_fixture(), "en")
    assert 'about "Spanish past tense"' in out
    assert "Weaknesses: irregular verbs" in out
    assert "Vocabulary already learned:" in out
    assert "Continue the learning session" in out


def test_analysis_context_empty_returns_blank():
    assert build_analysis_context({}, "de") == ""
    assert build_analysis_context(None, "en") == ""
    assert build_analysis_context({"strengths": [], "vocabulary": []}, "de") == ""


def test_analysis_context_skips_missing_fields():
    out = build_analysis_context({"topic": "Greetings"}, "en")
    assert 'about "Greetings"' in out
    assert "Summary:" not in out
    assert "Weaknesses:" not in out
    # The continue instruction is always present when there is any content.
    assert "Continue the learning session" in out


# --- Imported-chat transcript context (#1078) ------------------------------


def _conversation_fixture() -> list[ConversationTurn]:
    return [
        ConversationTurn(role="user", content="How do I use ser vs estar?"),
        ConversationTurn(role="assistant", content="Ser is for permanent traits."),
        ConversationTurn(role="user", content="And for location?"),
        ConversationTurn(role="assistant", content="Location uses estar."),
    ]


def test_conversation_context_includes_transcript_en():
    out = build_conversation_context(_conversation_fixture(), "en")
    assert "Imported conversation (previous chat)" in out
    assert "Learner: How do I use ser vs estar?" in out
    assert "Assistant: Ser is for permanent traits." in out
    assert "Assistant: Location uses estar." in out
    # The closing continue-instruction is present.
    assert "Continue from this previous conversation" in out
    # Nothing was dropped, so no omission marker.
    assert "omitted" not in out


def test_conversation_context_de_labels():
    out = build_conversation_context(_conversation_fixture(), "de")
    assert "Importierte Konversation" in out
    assert "Lerner: How do I use ser vs estar?" in out
    assert "Assistent: Ser is for permanent traits." in out
    assert "Knüpfe an diese vorherige Konversation an" in out


def test_conversation_context_empty_returns_blank():
    assert build_conversation_context([], "en") == ""
    assert build_conversation_context(None, "de") == ""
    # Whitespace-only turns are skipped → no renderable content.
    assert build_conversation_context([ConversationTurn(role="user", content="  ")], "en") == ""


def test_conversation_context_truncates_oldest_keeping_recent():
    # A long transcript: each turn ~1000 chars; a small budget keeps only the
    # most recent turns and flags the omission.
    turns = [
        ConversationTurn(role="user", content=f"msg{i} " + "x" * 1000)
        for i in range(10)
    ]
    out = build_conversation_context(turns, "en", char_budget=2500)
    assert "earlier messages omitted" in out
    # The most recent turns survive; the oldest are dropped.
    assert "msg9" in out
    assert "msg0" not in out
    # Body stays within ~budget (plus the few label lines).
    assert len(out) < 2500 + 600


def test_conversation_context_keeps_at_least_the_newest_turn():
    # Even a single over-budget turn is kept (never an empty body).
    turns = [ConversationTurn(role="user", content="y" * 5000)]
    out = build_conversation_context(turns, "en", char_budget=100)
    assert "yyyy" in out


# --- Learning-progress context (#797) --------------------------------------


def test_learning_context_empty_returns_blank():
    assert build_learning_context(None, "en") == ""
    assert (
        build_learning_context(
            LearningContext(topic="X", completed=[], in_progress=None, mistakes=[]),
            "en",
        )
        == ""
    )


def test_learning_context_renders_progress_and_mistakes_en():
    ctx = LearningContext(
        topic="French",
        completed=[CompletedLesson("fr — 01", 8, 10)],
        in_progress=InProgressLesson("fr — 02", 3),
        mistakes=[RecentMistake("bonjour", "bonsoir", "bonjour", 2)],
    )
    out = build_learning_context(ctx, "en")
    assert "LEARNING CONTEXT" in out
    assert "Completed lessons: fr — 01 (8/10)" in out
    assert "Currently working on: fr — 02, step 3" in out
    assert 'bonjour (answered "bonsoir", correct "bonjour", 2x)' in out
    assert 'You are a tutor for "French"' in out


def test_learning_context_german_labels():
    ctx = LearningContext(
        topic="Franzoesisch",
        completed=[CompletedLesson("fr — 01", 8, 10)],
        in_progress=None,
        mistakes=[],
    )
    out = build_learning_context(ctx, "de")
    assert "LERNKONTEXT" in out
    assert "Abgeschlossene Lektionen:" in out
    assert 'Du bist ein Tutor fuer "Franzoesisch"' in out


def test_learning_context_caps_lists():
    ctx = LearningContext(
        topic="T",
        completed=[CompletedLesson(f"l{i}", 1, 1) for i in range(20)],
        in_progress=None,
        mistakes=[RecentMistake(f"e{i}", "a", "b", 1) for i in range(20)],
    )
    out = build_learning_context(ctx, "en")
    assert "l11" in out and "l12" not in out
    assert "e7 " in out and "e8 " not in out


# --- build_language_directive (#827) ---------------------------------------


@pytest.mark.parametrize(
    "lang,expected",
    [
        ("de", "German (Deutsch)"),
        ("ko", "Korean (한국어)"),
        ("hi", "Hindi (हिन्दी)"),
        ("id", "Indonesian (Bahasa Indonesia)"),
        ("ja", "Japanese (日本語)"),
        ("pt-BR", "Portuguese (Português)"),
        ("tr", "Turkish (Türkçe)"),
    ],
)
def test_language_directive_names_the_learner_language(lang, expected):
    out = build_language_directive(lang)
    assert out.startswith("IMPORTANT: Always write your replies to the learner in ")
    assert expected in out


def test_language_directive_english_has_no_redundant_parenthetical():
    assert build_language_directive("en") == (
        "IMPORTANT: Always write your replies to the learner in English, "
        "regardless of the language of these instructions."
    )


def test_language_directive_falls_back_to_english_for_unknown_code():
    assert "English" in build_language_directive("xx")
    assert "English" in build_language_directive("")
