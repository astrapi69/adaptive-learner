"""Lesson schema - the backend's Pydantic Lesson over the generated models.

The STRUCTURAL field definitions live in ``schema_generated.py``, derived
from the canonical engine schema mirror (``schema/lesson.schema.json``,
pinned learn-content-engine release) via
``scripts/generate_pydantic_models.py``; the byte-parity gates prove the
mirror equals the pinned release.

This module adds only what the backend needs to STORE and SERVE a lesson.
Today that is one check: ``LessonStep.example_url`` must be an http(s)
URL (kept until a frontend guard for rendered links is proven active,
#3245). Every semantic authoring rule - per-type exercise payloads, cloze
marker counts, unique card/step ids, referential integrity, slug and
language-tag shapes - belongs to the engine (``learn-content-engine/rules``,
``src/rules.ts``): the content repos run it at authoring time and the
frontend runs it before a user set is saved (#3222). The backend used to
carry a Python copy of 25 of those rules and differed from the engine in
both directions (#3245, #1808); after parsing it reads no exercise content,
so the copy guarded nothing of its own and was removed.

Public API is unchanged: import ``Lesson``, ``Exercise``, ``Card``,
``ExerciseType`` etc. from this module as before.
"""

from __future__ import annotations

from typing import Any

from pydantic import Field, field_validator

from .schema_generated import (
    Card,
    CardTokenRole,
    ClozeBlank,
    ClozeMode,
    Direction,
    Exercise,
    ExerciseType,
    ExerciseVariable,
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
    "ExerciseVariable",
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


class LessonStep(LessonStepBase):
    """Structure from the generated base plus the http(s) ``example_url``
    check the backend keeps for rendered links (#3245)."""

    @field_validator("example_url")
    @classmethod
    def _http_example_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("example_url must be an http(s) URL")
        return value


class Lesson(LessonBase):
    """Structure from the generated base; ``steps`` is retargeted to the
    ``LessonStep`` subclass so nested validation runs its check. The
    structural constraint (steps non-empty) matches the generated base."""

    steps: list[LessonStep] = Field(..., min_length=1)


def lesson_to_dict(lesson: Lesson) -> dict[str, Any]:
    """Serialise a Lesson for transport (REST API / Dexie)."""
    return lesson.model_dump(mode="json")


def dict_to_lesson(payload: dict[str, Any]) -> Lesson:
    """Parse a Lesson dict back, running the structural validators plus
    the backend's own ``example_url`` check."""
    return Lesson.model_validate(payload)
