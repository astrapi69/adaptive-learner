"""Pilot content schema validation (Phase 51 / v1.34.0).

Every lesson JSON file under
``docs/explorations/sample-content/*/sets/*/lessons/`` must
parse cleanly against the v1.0 lesson schema. A broken JSON
file in the pilot directory is a release blocker — the same
files are bundled into the GH-Pages build (Phase 51D) and
loaded by the Content-Loader at runtime.

Parametrized across every discovered lesson file so the
failure message names exactly which file broke. Adding a new
lesson under the pilot tree picks up automatically — no test
edit needed.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from adaptive_learner_content_loader.schema import dict_to_lesson

REPO_ROOT = Path(__file__).resolve().parents[3]
PILOT_ROOT = REPO_ROOT / "docs" / "explorations" / "sample-content"


def _discover_lesson_files() -> list[Path]:
    """Find every lesson JSON shipped in the pilot tree.

    Pattern: ``sample-content/{set-dir}/sets/{set-id}/lessons/NN-slug.json``.
    Sorted for deterministic test ordering.
    """
    return sorted(PILOT_ROOT.glob("*/sets/*/lessons/*.json"))


def _file_id(path: Path) -> str:
    """Compact id for pytest's parametrize display.

    Trims the absolute path down to ``{set-dir}/{filename}`` so the
    failure line names the file in a recognisable form.
    """
    return f"{path.parent.parent.parent.name}/{path.name}"


LESSON_FILES = _discover_lesson_files()


@pytest.mark.parametrize("path", LESSON_FILES, ids=_file_id)
def test_pilot_lesson_validates(path: Path) -> None:
    """Every pilot lesson JSON must parse against the v1.0 schema.

    Runs the FULL ``Lesson.model_validate`` pipeline so the same
    contract the content-loader enforces at download time also
    catches authoring bugs at ``make test`` time.
    """
    with path.open(encoding="utf-8") as f:
        payload = json.load(f)
    lesson = dict_to_lesson(payload)
    # Sanity assertions that catch obviously-empty content
    # (the schema permits 1+ step but the pilot convention is
    # multi-step lessons).
    assert lesson.steps, f"{path.name}: lesson has no steps"
    assert lesson.cards, f"{path.name}: lesson has no cards"


def test_pilot_tree_is_non_empty() -> None:
    """The pilot directory must ship at least one lesson.

    Guards against a future ``git rm`` that accidentally removes
    every JSON file under ``sample-content/`` — the parametrized
    test above would silently pass with zero discovered files
    otherwise.
    """
    assert LESSON_FILES, (
        "No lesson JSON files found under "
        f"{PILOT_ROOT.relative_to(REPO_ROOT)} — check the pilot tree."
    )


@pytest.mark.parametrize("path", LESSON_FILES, ids=_file_id)
def test_pilot_lesson_has_exercise_variety(path: Path) -> None:
    """Pilot lessons should mix multiple exercise types.

    Not a schema rule, but the pilot's pedagogical convention:
    each lesson should drill at least 2 of the 4 exercise types
    so the learner sees varied stimuli. A 100%-matching lesson
    is allowed by the schema but flagged here.
    """
    with path.open(encoding="utf-8") as f:
        payload = json.load(f)
    lesson = dict_to_lesson(payload)
    exercise_types: set[str] = set()
    for step in lesson.steps:
        if step.exercise is not None:
            exercise_types.add(step.exercise.type.value)
    assert len(exercise_types) >= 2, (
        f"{path.name}: only {len(exercise_types)} exercise type(s) — "
        "pilot lessons should mix at least 2 types for varied practice."
    )
