"""Lesson schema - semantic layer over the generated structural models (D3b).

The STRUCTURAL field definitions live in ``schema_generated.py``, derived
from the canonical engine schema mirror (``schema/lesson.schema.json``,
pinned learn-content-engine release) via
``scripts/generate_pydantic_models.py``. This module layers the SEMANTIC
cross-field rules on top as thin subclasses - the rules JSON-Schema cannot
express (per-type required fields, cloze marker/blank count, multiselect
correct-counts, referential integrity, slug/BCP-47 shapes). The engine
keeps its own semantic layer hand-written in ``validate.ts`` for the same
reason; the byte-parity gates prove the mirror equals the pinned release.

Public API is unchanged: import ``Lesson``, ``Exercise``, ``Card``,
``ExerciseType`` etc. from this module as before.
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import Field, field_validator, model_validator

from .schema_generated import (
    Card as CardBase,
    CardTokenRole,
    ClozeBlank,
    ClozeMode,
    Direction,
    Exercise as ExerciseBase,
    ExerciseType,
    InlineExample,
    Lesson as LessonBase,
    LessonResource,
    LessonStep as LessonStepBase,
    MediaType,
    MultipleChoiceOption,
    Pair,
    PictureImage,
    StepType,
    TokenRole,
)

__all__ = [
    "Card",
    "CardTokenRole",
    "ClozeBlank",
    "ClozeMode",
    "Direction",
    "Exercise",
    "ExerciseType",
    "InlineExample",
    "Lesson",
    "LessonResource",
    "LessonStep",
    "MediaType",
    "MultipleChoiceOption",
    "Pair",
    "PictureImage",
    "StepType",
    "TokenRole",
    "dict_to_lesson",
    "lesson_to_dict",
]

# Slug-safe identifier — same shape as ContentSet.id /
# ContentSet.tags. Used for lesson_id, card_id, step ids.
_SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# BCP-47 subset — kept in sync with ``models.py``. Used for the
# optional language-pair fields on ``Lesson`` (Phase 60 /
# v1.44.0). The set-level fields are authoritative; the lesson
# copies are optional and let an exported standalone lesson
# carry its own language pair.
_LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")


class Card(CardBase):
    """Semantic layer: slug-shaped ``id`` + ``tags`` (structure in the
    generated base)."""

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError(
                "Card id must be slug-safe "
                "(lowercase letters / digits / hyphens, "
                "no leading/trailing hyphen)"
            )
        return value

    @field_validator("tags")
    @classmethod
    def _slug_tags(cls, value: list[str]) -> list[str]:
        for tag in value:
            if not _SLUG_RE.fullmatch(tag):
                raise ValueError(f"tag '{tag}' must be slug-safe")
        return value




class Exercise(ExerciseBase):
    """Semantic layer: slug ids + the per-type cross-field rules
    (structure in the generated base)."""

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("Exercise id must be slug-safe")
        return value

    @field_validator("card_ids")
    @classmethod
    def _slug_card_ids(cls, value: list[str]) -> list[str]:
        for cid in value:
            if not _SLUG_RE.fullmatch(cid):
                raise ValueError(f"card_id '{cid}' must be slug-safe")
        return value

    @model_validator(mode="after")
    def _enforce_type_specific_fields(self) -> Exercise:
        """Each ExerciseType requires a specific field set.

        Wrong-field-for-type combos (e.g. a MATCHING exercise
        without ``pairs``) are rejected at schema validation
        time so the viewer can trust the data shape later.
        Dispatches to a per-type validator; types with no extra
        constraints fall through unchecked.
        """
        validators = {
            ExerciseType.MATCHING: self._validate_matching_fields,
            ExerciseType.PICTURE_CHOICE: self._validate_picture_choice_fields,
            ExerciseType.FREE_TEXT: self._validate_free_text_fields,
            ExerciseType.WORD_TILES: self._validate_word_tiles_fields,
            ExerciseType.CLOZE: self._validate_cloze_fields,
            ExerciseType.MULTIPLE_CHOICE: self._validate_multiple_choice_fields,
        }
        validate = validators.get(self.type)
        if validate is not None:
            validate()
        return self

    def _validate_multiple_choice_fields(self) -> None:
        """MULTIPLE_CHOICE (schema v1.6): >= 2 unique options; single mode
        needs exactly one correct, multi mode at least one.

        Mirrors the engine's ``checkMultipleChoice`` (learn-content-engine
        0.8.0). Option shape ({text, correct?}) is enforced by the
        ``MultipleChoiceOption`` model (``extra="forbid"``); only the
        cross-option rules live here.
        """
        if not self.options or len(self.options) < 2:
            raise ValueError("MULTIPLE_CHOICE requires at least 2 'options'")
        correct_count = sum(1 for option in self.options if option.correct)
        if self.multiple:
            if correct_count == 0:
                raise ValueError(
                    "MULTIPLE_CHOICE with 'multiple' requires at least one "
                    "option marked 'correct'"
                )
        elif correct_count != 1:
            raise ValueError(
                "MULTIPLE_CHOICE (single) must have exactly one option "
                "marked 'correct'"
            )
        texts = [option.text for option in self.options]
        if len(set(texts)) != len(texts):
            raise ValueError(
                "MULTIPLE_CHOICE option texts must be unique "
                "(the text IS the option)"
            )

    def _validate_matching_fields(self) -> None:
        """MATCHING requires non-empty 'pairs', unless ``from_cards`` derives
        them from the referenced cards.

        Each pair's exact ``{left, right}`` shape is enforced by the
        ``Pair`` model (required fields + ``extra="forbid"``)
        (EXP-039), so only the non-empty count is checked here. ``from_cards``
        mirrors the engine (learn-content-engine 0.7.0): it requires non-empty
        ``card_ids`` and forbids an explicit ``pairs`` list.
        """
        if self.from_cards:
            if not self.card_ids:
                raise ValueError(
                    "MATCHING with 'from_cards' requires non-empty 'card_ids'"
                )
            if self.pairs:
                raise ValueError(
                    "MATCHING with 'from_cards' must not also list explicit 'pairs'"
                )
            return
        if not self.pairs:
            raise ValueError("MATCHING exercise requires non-empty 'pairs'")

    def _validate_picture_choice_fields(self) -> None:
        """PICTURE_CHOICE requires >= 2 images, exactly one correct.

        Each image's ``{src, label, is_correct?}`` shape (required
        src+label, no extra keys) is enforced by the ``PictureImage``
        model (EXP-039); only the cross-image rules — at least two
        options and exactly one marked correct — live here.
        """
        if not self.images or len(self.images) < 2:
            raise ValueError("PICTURE_CHOICE requires at least 2 'images'")
        correct_count = sum(1 for img in self.images if img.is_correct == "true")
        if correct_count != 1:
            raise ValueError(
                "PICTURE_CHOICE must have exactly one image marked 'is_correct': 'true'"
            )

    def _validate_free_text_fields(self) -> None:
        """FREE_TEXT requires a non-empty 'accept' list."""
        if not self.accept:
            raise ValueError("FREE_TEXT exercise requires non-empty 'accept'")

    def _validate_word_tiles_fields(self) -> None:
        """WORD_TILES requires >= 2 tiles; accept_orderings must permute the tiles."""
        if not self.tiles or len(self.tiles) < 2:
            raise ValueError("WORD_TILES requires at least 2 'tiles'")
        # accept_orderings (when present) must permute the tile index range.
        if not self.accept_orderings:
            return
        tile_count = len(self.tiles)
        valid_indices = set(range(tile_count))
        for ordering in self.accept_orderings:
            if sorted(ordering) != list(range(tile_count)):
                raise ValueError(
                    f"accept_orderings entry "
                    f"{ordering} must be a "
                    f"permutation of [0..{tile_count - 1}]"
                )
            if set(ordering) != valid_indices:
                raise ValueError("accept_orderings entries must use every tile index exactly once")

    def _validate_cloze_fields(self) -> None:
        """CLOZE (Phase 52D / P-127). The ``multiselect`` mode (#1195) is a
        whole-question 'select all that apply' shape (sentence = question,
        ``correct_answers`` + ``distractors``); the blank-based ``type`` /
        ``select`` modes require sentence + blanks with a matching '___'
        marker count, and ``select`` also needs a non-empty distractor pool."""
        if self.cloze_mode == "multiselect":
            self._validate_cloze_multiselect_fields()
            return
        if not self.sentence:
            raise ValueError("CLOZE exercise requires non-empty 'sentence'")
        if not self.blanks:
            raise ValueError("CLOZE exercise requires non-empty 'blanks'")
        marker_count = self.sentence.count("___")
        if marker_count != len(self.blanks):
            raise ValueError(
                f"CLOZE marker count mismatch: sentence has "
                f"{marker_count} '___' markers but blanks has "
                f"{len(self.blanks)} entries"
            )
        # ``select`` mode requires a non-empty distractor pool to populate the
        # per-blank ``<select>`` options.
        if self.cloze_mode == "select" and not self.distractors:
            raise ValueError("CLOZE with cloze_mode='select' requires non-empty 'distractors'")

    def _validate_cloze_multiselect_fields(self) -> None:
        """CLOZE ``multiselect`` (#1195): a question stem + two disjoint,
        non-empty option lists. Reuses ``accept`` (EVERY entry is a correct
        option in this mode) + ``distractors`` (the wrong options). No
        blanks/markers."""
        if not self.sentence:
            raise ValueError("CLOZE multiselect requires a non-empty 'sentence' (the question)")
        if not self.accept:
            raise ValueError("CLOZE multiselect requires non-empty 'accept' (the correct options)")
        if not self.distractors:
            raise ValueError("CLOZE multiselect requires non-empty 'distractors'")
        overlap = set(self.accept) & set(self.distractors)
        if overlap:
            raise ValueError(
                "CLOZE multiselect 'accept' and 'distractors' must be "
                f"disjoint; shared option(s): {sorted(overlap)}"
            )



class LessonStep(LessonStepBase):
    """Semantic layer: theory/exercise payload rule + http(s) example_url
    + slug id. ``exercise`` is retargeted to the semantic ``Exercise``
    subclass so nested validation runs the cross-field rules."""

    exercise: Exercise | None = None

    @field_validator("example_url")
    @classmethod
    def _http_example_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("example_url must be an http(s) URL")
        return value

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("LessonStep id must be slug-safe")
        return value

    @model_validator(mode="after")
    def _enforce_type_payload(self) -> LessonStep:
        if self.type is StepType.THEORY:
            if not self.body:
                raise ValueError("THEORY step requires non-empty 'body'")
            if self.exercise is not None:
                raise ValueError("THEORY step must not carry 'exercise'")
        else:  # EXERCISE
            if self.exercise is None:
                raise ValueError("EXERCISE step requires 'exercise' payload")
            if self.body is not None:
                raise ValueError(
                    "EXERCISE step must not carry 'body' (use the exercise's prompt instead)"
                )
        return self




class Lesson(LessonBase):
    """Semantic layer: slug/BCP-47 shapes, unique card/step ids and
    referential integrity. ``cards``/``steps`` are retargeted to the
    semantic subclasses so nested validation runs their rules; the
    structural constraints (steps non-empty, cards default empty) match
    the generated base."""

    cards: list[Card] = Field(default_factory=list)
    steps: list[LessonStep] = Field(..., min_length=1)

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("Lesson id must be slug-safe")
        return value

    @field_validator("target_language", "source_language")
    @classmethod
    def _bcp47_language(cls, value: str | None) -> str | None:
        if value is not None and not _LANGUAGE_RE.fullmatch(value):
            raise ValueError("language codes must be BCP-47 (e.g. 'fr', 'de-AT', 'zh-Hans')")
        return value

    @field_validator("cards")
    @classmethod
    def _unique_card_ids(cls, value: list[Card]) -> list[Card]:
        seen: set[str] = set()
        for card in value:
            if card.id in seen:
                raise ValueError(f"duplicate card id '{card.id}' in lesson")
            seen.add(card.id)
        return value

    @field_validator("steps")
    @classmethod
    def _unique_step_ids(cls, value: list[LessonStep]) -> list[LessonStep]:
        seen: set[str] = set()
        for step in value:
            if step.id in seen:
                raise ValueError(f"duplicate step id '{step.id}' in lesson")
            seen.add(step.id)
        return value

    @model_validator(mode="after")
    def _referential_integrity(self) -> Lesson:
        """Every exercise.card_ids reference must resolve."""
        known_card_ids = {c.id for c in self.cards}
        for step in self.steps:
            if step.exercise is None:
                continue
            for card_id in step.exercise.card_ids:
                if card_id not in known_card_ids:
                    raise ValueError(
                        f"exercise '{step.exercise.id}' "
                        f"references unknown card '{card_id}' "
                        f"(known: {sorted(known_card_ids) or 'none'})"
                    )
        return self

    def get_step(self, step_id: str) -> LessonStep | None:
        """Look up a step by id. Used by the viewer for
        deep-linking (``/lesson/{id}#{step_id}``)."""
        for step in self.steps:
            if step.id == step_id:
                return step
        return None

    def get_card(self, card_id: str) -> Card | None:
        """Look up a card by id. Used by the SRS layer when
        scheduling reviews after a wrong answer."""
        for card in self.cards:
            if card.id == card_id:
                return card
        return None




def lesson_to_dict(lesson: Lesson) -> dict[str, Any]:
    """Serialise a Lesson for transport (REST API / Dexie)."""
    return lesson.model_dump(mode="json")


def dict_to_lesson(payload: dict[str, Any]) -> Lesson:
    """Parse a Lesson dict back, running ALL validators."""
    return Lesson.model_validate(payload)
