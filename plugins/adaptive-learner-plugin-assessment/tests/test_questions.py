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


@pytest.mark.parametrize("lang", ["fr", "ja", "es", ""])
def test_unknown_language_falls_back_to_en(lang: str):
    out = questions_for_lang(lang)
    assert out[0]["text"] == QUESTIONS[0]["text_en"]


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
