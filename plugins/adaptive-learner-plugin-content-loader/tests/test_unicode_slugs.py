"""Regression pins for #1808 - unicode-lowercase lesson-internal slugs.

German (and any non-ASCII) authored content naturally carries umlaut
ids and tags ('waehrung' was authored as 'währung', 'präsenz'). The
canonical engine schema constrains Card.id / Card.tags to plain
strings, so the app's semantic layer must not be stricter: lesson-
INTERNAL identifiers accept lowercase unicode letters. Set-level
identifiers (ContentSet.id / path / filenames) stay ASCII - they are
URLs and cache keys.
"""

from __future__ import annotations

import pytest
from adaptive_learner_content_loader.models import ContentSet
from adaptive_learner_content_loader.schema import (
    Card,
    Exercise,
    ExerciseType,
    Lesson,
    LessonStep,
    StepType,
)
from pydantic import ValidationError


def _lesson_with(card: Card) -> Lesson:
    return Lesson(
        id="uebersicht",
        title="Die Waehrung des Geistes",
        cards=[card],
        steps=[
            LessonStep(
                id="einfuehrung",
                type=StepType.THEORY,
                title="Theorie",
                body="Ein Ueberblick.",
            )
        ],
    )


class TestUnicodeCardSlugs:
    def test_card_id_accepts_umlauts(self) -> None:
        card = Card(id="präsenz", front="Präsenz", back="presence")
        assert card.id == "präsenz"

    def test_card_tags_accept_umlauts(self) -> None:
        card = Card(id="w1", front="Währung", back="currency", tags=["währung"])
        assert card.tags == ["währung"]

    def test_lesson_with_umlaut_cards_validates(self) -> None:
        lesson = _lesson_with(
            Card(id="präsenz", front="Präsenz", back="presence", tags=["währung"])
        )
        assert lesson.cards[0].tags == ["währung"]

    def test_exercise_card_ids_accept_umlauts(self) -> None:
        exercise = Exercise(
            id="übung-1",
            type=ExerciseType.FREE_TEXT,
            prompt="Was ist Präsenz?",
            card_ids=["präsenz"],
            accept=["presence", "attention"],
        )
        assert exercise.card_ids == ["präsenz"]

    def test_lesson_step_id_accepts_umlauts(self) -> None:
        step = LessonStep(
            id="einführung",
            type=StepType.THEORY,
            title="Theorie",
            body="Text.",
        )
        assert step.id == "einführung"


class TestSlugRejectionsStay:
    def test_uppercase_still_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="Präsenz", front="x", back="y")

    def test_spaces_still_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="w1", front="x", back="y", tags=["bad tag"])

    def test_double_hyphen_still_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="a--b", front="x", back="y")

    def test_leading_hyphen_still_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="-präsenz", front="x", back="y")


class TestSetLevelStaysAscii:
    def test_content_set_id_rejects_umlauts(self) -> None:
        with pytest.raises(ValidationError):
            ContentSet(
                id="währung-des-geistes",
                title="x",
                target_language="de",
                source_language="de",
                level="B1",
                version="1.0.0",
                lessons=[],
            )
