"""Tests for the analysis-to-lesson generator (Phase 59A / v1.42.0)."""

from __future__ import annotations

from adaptive_learner_content_loader.analysis_to_lesson import (
    AnalysisLessonConfig,
    generate_lesson_from_analysis,
    slugify,
    summarize_generated_lesson,
)
from adaptive_learner_content_loader.schema import ExerciseType, Lesson, StepType

RICH: dict = {
    "topic": "Spanish travel vocabulary",
    "user_level": "beginner",
    "summary": "A conversation about ordering food and asking directions.",
    "recommended_focus": "Article gender agreement",
    "subtopics": ["Restaurant", "Directions"],
    "strengths": ["Good greeting vocabulary", "Confident with numbers"],
    "weaknesses": ["Mixes up ser and estar"],
    "error_patterns": ["Wrong article gender", "Missing accents"],
    "suggested_curriculum": [
        {"title": "Order in a cafe", "description": "Practice cafe phrases.", "priority": 1},
        {"title": "Ask for directions", "description": "Where is ...?", "priority": 2},
    ],
    "vocabulary": [
        {"word": "la cuenta", "translation": "the bill", "example": "La cuenta, por favor."},
        {"word": "el agua", "translation": "the water", "example": "Quiero el agua fria."},
        {"word": "la calle", "translation": "the street", "example": "La calle esta cerca."},
        {"word": "izquierda", "translation": "left", "example": "Gira a la izquierda."},
        {"word": "derecha", "translation": "right", "example": "La derecha"},
        {"word": "gracias", "translation": "thank you", "tags": ["Polite Phrase", "basics"]},
    ],
}


def test_generates_a_schema_valid_lesson() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="conv-1")
    assert isinstance(lesson, Lesson)  # constructing Lesson already validated
    assert lesson.id == "conv-1"
    assert lesson.title == "Spanish travel vocabulary"
    assert lesson.estimated_minutes >= 1
    assert len(lesson.steps) > 0


def test_is_deterministic() -> None:
    a = generate_lesson_from_analysis(RICH, lesson_id="conv-1")
    b = generate_lesson_from_analysis(RICH, lesson_id="conv-1")
    assert a.model_dump() == b.model_dump()


def test_id_derives_from_topic_when_absent() -> None:
    lesson = generate_lesson_from_analysis(RICH)
    assert lesson.id == "analysis-spanish-travel-vocabulary"


def test_theory_steps_from_real_fields() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="c")
    ids = [s.id for s in lesson.steps if s.type is StepType.THEORY]
    for expected in (
        "theory-overview",
        "theory-plan-0",
        "theory-plan-1",
        "theory-topics",
        "theory-strengths",
        "theory-weaknesses",
        "theory-errors",
    ):
        assert expected in ids
    overview = next(s for s in lesson.steps if s.id == "theory-overview")
    assert "ordering food" in (overview.body or "")
    assert "Article gender agreement" in (overview.body or "")


def test_exercise_type_variety() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="c")
    summary = summarize_generated_lesson(lesson)
    assert summary["exercises"] > 0
    counts = summary["exercise_type_counts"]
    assert counts.get("matching", 0) > 0
    assert counts.get("free_text", 0) > 0
    assert counts.get("cloze", 0) > 0
    assert counts.get("word_tiles", 0) > 0


def test_exercises_ordered_easy_to_hard() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="c")
    types = [s.exercise.type for s in lesson.steps if s.type is StepType.EXERCISE]
    first_matching = next((i for i, t in enumerate(types) if t is ExerciseType.MATCHING), -1)
    first_tiles = next((i for i, t in enumerate(types) if t is ExerciseType.WORD_TILES), -1)
    assert first_matching >= 0
    if first_tiles != -1:
        assert first_matching < first_tiles


def test_cloze_only_from_examples_and_marker_matches_blanks() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="c")
    for step in lesson.steps:
        if step.exercise and step.exercise.type is ExerciseType.CLOZE:
            assert step.exercise.sentence is not None
            assert step.exercise.sentence.count("___") == len(step.exercise.blanks or [])
    ex_ids = [s.exercise.id for s in lesson.steps if s.exercise]
    # "gracias" (index 5) has no example -> no cloze / tiles.
    assert "ex-cloze-5" not in ex_ids
    assert "ex-tiles-5" not in ex_ids


def test_free_text_accepts_translation() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="c")
    free = next(s for s in lesson.steps if s.exercise and s.exercise.type is ExerciseType.FREE_TEXT)
    assert "the bill" in (free.exercise.accept or [])
    assert "la cuenta" in free.exercise.prompt


def test_max_exercises_cap() -> None:
    lesson = generate_lesson_from_analysis(
        RICH, lesson_id="c", config=AnalysisLessonConfig(max_exercises=3)
    )
    assert summarize_generated_lesson(lesson)["exercises"] == 3


def test_tags_slugified() -> None:
    lesson = generate_lesson_from_analysis(RICH, lesson_id="c")
    gracias = next(c for c in lesson.cards if c.back == "thank you")
    assert gracias.tags == ["polite-phrase", "basics"]


def test_theory_only_when_vocabulary_too_small() -> None:
    thin = {
        "topic": "Tiny chat",
        "summary": "Short.",
        "vocabulary": [
            {"word": "hola", "translation": "hi"},
            {"word": "adios", "translation": "bye"},
        ],
    }
    lesson = generate_lesson_from_analysis(thin, lesson_id="thin")
    summary = summarize_generated_lesson(lesson)
    assert summary["theory_only"] is True
    assert summary["exercises"] == 0
    assert len(lesson.steps) >= 1


def test_minimal_and_empty_analysis() -> None:
    minimal = generate_lesson_from_analysis(
        {"topic": "Just a topic", "summary": "Only a summary."}, lesson_id="m"
    )
    assert summarize_generated_lesson(minimal)["theory_only"] is True
    assert minimal.steps[0].id == "theory-overview"

    empty = generate_lesson_from_analysis({}, lesson_id="e")
    assert empty.title == "Imported lesson"
    assert len(empty.steps) >= 1


def test_slugify() -> None:
    assert slugify("Se présenter") == "se-presenter"
    assert slugify("  Hello,  World!! ") == "hello-world"
    assert slugify("!!!") == ""
