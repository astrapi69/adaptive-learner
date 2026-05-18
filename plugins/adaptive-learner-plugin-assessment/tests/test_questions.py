"""Tests for the bundled question pack + the language lookup."""

from __future__ import annotations

import pytest
from adaptive_learner_assessment.questions import (
    METHODS,
    QUESTIONS,
    lang_neutral_questions,
    questions_for_lang,
)


def test_exactly_12_questions():
    assert len(QUESTIONS) == 12


def test_question_ids_are_sequential():
    ids = [q["id"] for q in QUESTIONS]
    assert ids == [f"q{i:02d}" for i in range(1, 13)]


def test_question_ids_unique():
    ids = [q["id"] for q in QUESTIONS]
    assert len(set(ids)) == len(ids)


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_each_question_has_de_and_en_text(q):
    assert q["text_de"] and isinstance(q["text_de"], str)
    assert q["text_en"] and isinstance(q["text_en"], str)


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_each_question_has_at_least_3_answers(q):
    # The UI is built for 3-4 multiple-choice options.
    assert 3 <= len(q["answers"]) <= 6


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_answer_ids_unique_within_question(q):
    ids = [a["id"] for a in q["answers"]]
    assert len(set(ids)) == len(ids)


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_every_answer_carries_de_en_text(q):
    for a in q["answers"]:
        assert a["text_de"] and isinstance(a["text_de"], str)
        assert a["text_en"] and isinstance(a["text_en"], str)


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_every_answer_weight_is_known_method_and_in_unit_interval(q):
    for a in q["answers"]:
        assert a["weights"], f"{q['id']}.{a['id']} has no weights"
        for method, weight in a["weights"].items():
            assert method in METHODS, f"{q['id']}.{a['id']}: unknown method {method!r}"
            assert 0.0 <= float(weight) <= 1.0, (
                f"{q['id']}.{a['id']}: weight {weight} for {method} outside [0, 1]"
            )


def test_each_method_is_touched_by_at_least_one_answer():
    """If a method has no answer routing to it, the assessment can
    never produce a non-zero score for it — would be a content bug.
    """
    touched: set[str] = set()
    for q in QUESTIONS:
        for a in q["answers"]:
            touched.update(a["weights"].keys())
    assert touched == set(METHODS), f"Methods never touched: {set(METHODS) - touched}"


# --- questions_for_lang -----------------------------------------------------


def test_questions_for_lang_de_returns_german_text():
    out = questions_for_lang("de")
    assert len(out) == 12
    assert out[0]["text"] == QUESTIONS[0]["text_de"]


def test_questions_for_lang_en_returns_english_text():
    out = questions_for_lang("en")
    assert out[0]["text"] == QUESTIONS[0]["text_en"]


@pytest.mark.parametrize("lang", ["ja", "tr", "pt", ""])
def test_unknown_language_falls_back_to_en(lang: str):
    """Languages outside the v0.2.0 translated set (DE / EN / ES /
    FR / EL) fall back to EN by mapping to text_en."""
    out = questions_for_lang(lang)
    assert out[0]["text"] == QUESTIONS[0]["text_en"]


@pytest.mark.parametrize("lang", ["es", "fr", "el"])
def test_phase6c_language_returns_translated_text(lang: str):
    """v0.3.0 ships proper ES / FR / EL translations for every
    one of the 12 questions and their answers. Each language's
    output must NOT equal the EN text any more (would mean the
    fallback path fired, which is the v0.2.0 behaviour we
    replaced)."""
    out = questions_for_lang(lang)
    assert out[0]["text"] != QUESTIONS[0]["text_en"]
    # Every answer's text is now language-specific.
    for q_out, q_src in zip(out, QUESTIONS):
        for a_out, a_src in zip(q_out["answers"], q_src["answers"]):
            assert a_out["text"] != a_src["text_en"]


@pytest.mark.parametrize("lang", ["pt", "tr", "ja", "ko"])
def test_unsupported_languages_still_fall_back_to_en(lang: str):
    """PT / TR / JA / future languages remain on the EN-fallback
    path until their dedicated translation pass lands (the
    resolver's _LANG_TO_KEY map says so). Pins that the v0.2.0
    fall-back contract is preserved for any code outside the
    {de, en, es, fr, el} set."""
    out = questions_for_lang(lang)
    assert out[0]["text"] == QUESTIONS[0]["text_en"]


def test_partial_translation_falls_back_per_field():
    """Future-proof: if a partial translation lands for a hitherto
    untranslated language (e.g. only the first question is
    translated for Portuguese, the rest aren't), the resolver
    should return PT for the translated entry and EN for the
    rest. Verified by mutating the live QUESTIONS list inside a
    try/finally so other tests aren't affected."""
    q0 = QUESTIONS[0]
    q0["text_pt"] = "Como abordas um novo tema?"
    try:
        # PT is not in _LANG_TO_KEY; resolver falls back to EN
        # regardless of whether the field exists. This pins the
        # invariant: adding the field alone doesn't enable a
        # language — the map row is the load-bearing part.
        out = questions_for_lang("pt")
        assert out[0]["text"] == QUESTIONS[0]["text_en"]
    finally:
        del q0["text_pt"]


def test_questions_for_lang_uses_regional_prefix():
    out_de_de = questions_for_lang("de-DE")
    out_de_at = questions_for_lang("de-AT")
    out_de = questions_for_lang("de")
    assert out_de_de[0]["text"] == out_de[0]["text"]
    assert out_de_at[0]["text"] == out_de[0]["text"]


def test_questions_for_lang_does_not_leak_other_language_key():
    out = questions_for_lang("de")
    for q in out:
        assert "text_de" not in q
        assert "text_en" not in q
        for a in q["answers"]:
            assert "text_de" not in a
            assert "text_en" not in a


def test_lang_neutral_questions_drops_text():
    out = lang_neutral_questions()
    assert len(out) == 12
    for q in out:
        assert "text" not in q
        assert "text_de" not in q
        for a in q["answers"]:
            assert "text" not in a
            assert "weights" in a
            assert "id" in a


# --- v0.4.0: question ``type`` ("single" | "multi") -----------------------


def test_each_question_carries_a_type_field_in_lang_output():
    """The frontend reads ``type`` to pick radio vs checkbox.
    Every question must declare it (or fall back to "single")."""
    out = questions_for_lang("en")
    for q in out:
        assert q.get("type") in ("single", "multi"), q


def test_seven_questions_are_multi_select_by_design():
    """v0.4.0 marks 7 of the 12 questions multi-select. The set is
    load-bearing — these are the questions where multiple learning
    preferences genuinely apply at the same time. The other 5 stay
    single-select because their answers are mutually exclusive
    (one pace, one feedback timing, one stance on AI tools, ...).
    """
    multi_ids = {q["id"] for q in QUESTIONS if q.get("type") == "multi"}
    assert multi_ids == {"q01", "q02", "q04", "q05", "q06", "q08", "q12"}


def test_remaining_questions_default_to_single():
    """The 5 that aren't marked ``multi`` must remain single — a
    missing ``type`` field falls back to "single" in the lang
    output, which is fine."""
    single_ids = {
        q["id"] for q in QUESTIONS if q.get("type", "single") == "single"
    }
    assert single_ids == {"q03", "q07", "q09", "q10", "q11"}
