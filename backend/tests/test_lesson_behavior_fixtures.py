"""Behaviour fixtures for the schema-authority migration (Phase 0, #1516).

Pins what the app's Python lesson validation ACCEPTS and REJECTS today,
so the Phase 2 flip (``$id`` moves to the engine-own URL, the app
becomes the schema consumer) can prove the runtime behaviour did not
change: these fixtures and assertions stay byte-identical across the
flip.

The validation surface under test is
``adaptive_learner_content_loader.schema.dict_to_lesson`` — the
canonical parse entry that runs ALL Pydantic validators (structural
shape, closed enums, ``extra="forbid"``, plus the cross-field semantic
rules JSON-Schema cannot express).

Fixture layout (shared with the frontend ajv pin in
``frontend/src/lib/content/validation/lesson-behavior-fixtures.test.ts``,
cross-language parity pattern):

* ``valid/``            accepted by Pydantic AND by the ajv shape check
* ``invalid/``          structural violations — rejected by BOTH layers
* ``invalid-semantic/`` cross-field violations — rejected by Pydantic;
                        the ajv STRUCTURAL check passes them by design
                        (the semantic layer lives in
                        ``validateGeneratedLesson``)
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from adaptive_learner_content_loader.schema import dict_to_lesson
from pydantic import ValidationError

FIXTURES_ROOT = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "lesson-schema-behavior"
)


def _fixture_names(subdir: str) -> list[str]:
    return sorted(path.name for path in (FIXTURES_ROOT / subdir).glob("*.json"))


def _load(subdir: str, name: str) -> dict:
    return json.loads((FIXTURES_ROOT / subdir / name).read_text(encoding="utf-8"))


def test_fixture_set_is_complete() -> None:
    """The pinned corpus keeps its full pre-flip extent."""
    assert _fixture_names("valid") == [
        "full-all-exercise-types.json",
        "minimal-theory-only.json",
    ]
    assert _fixture_names("invalid") == [
        "missing-required-title.json",
        "steps-not-an-array.json",
        "unknown-exercise-type.json",
        "unknown-top-level-field.json",
    ]
    assert _fixture_names("invalid-semantic") == [
        "cloze-marker-mismatch.json",
        "exercise-references-unknown-card.json",
        "matching-without-pairs.json",
    ]


@pytest.mark.parametrize("name", _fixture_names("valid"))
def test_valid_lesson_fixture_is_accepted(name: str) -> None:
    """Every valid fixture parses through the full validator chain."""
    lesson = dict_to_lesson(_load("valid", name))
    assert lesson.id
    assert lesson.steps


def test_valid_full_fixture_covers_all_five_exercise_types() -> None:
    """The full fixture exercises the complete closed ExerciseType enum."""
    lesson = dict_to_lesson(_load("valid", "full-all-exercise-types.json"))
    exercised = {step.exercise.type.value for step in lesson.steps if step.exercise is not None}
    assert exercised == {"matching", "picture_choice", "free_text", "word_tiles", "cloze"}


@pytest.mark.parametrize("name", _fixture_names("invalid"))
def test_structurally_invalid_lesson_fixture_is_rejected(name: str) -> None:
    """Structural violations (missing required field, unknown enum value,
    forbidden extra field, wrong JSON type) are rejected."""
    with pytest.raises(ValidationError):
        dict_to_lesson(_load("invalid", name))


@pytest.mark.parametrize("name", _fixture_names("invalid-semantic"))
def test_semantically_invalid_lesson_fixture_is_rejected(name: str) -> None:
    """Cross-field violations (matching without pairs, cloze marker count
    mismatch, dangling card reference) are rejected by the Pydantic
    model validators."""
    with pytest.raises(ValidationError):
        dict_to_lesson(_load("invalid-semantic", name))
