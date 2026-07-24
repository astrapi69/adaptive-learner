"""Lesson splitter (Phase 63G / EXP-020).

TypeScript mirror: ``frontend/src/lib/content/lesson-splitter.ts``

Splits a ``Lesson`` into multiple parts when it exceeds
``max_steps_per_part``. Each part is a self-contained ``Lesson`` —
only the cards referenced by the part's steps are included so the
sub-lesson validates correctly.

Rules (must match the TS mirror exactly for parity tests):
  - If ``len(lesson.steps) <= max_steps_per_part``, returns
    ``[lesson]`` unchanged.
  - Steps are chunked in order; no step is reordered.
  - Each part carries a title suffix " — Part N of M".
  - Each part's id is ``"{lesson.id}-part-{n}"`` (1-indexed).
  - ``estimated_minutes`` scales proportionally (minimum 1).
  - Cards not referenced by any step in the part are excluded.
"""

from __future__ import annotations

import math
from typing import Any

from .schema import Card, Exercise, Lesson, LessonStep

DEFAULT_MAX_STEPS: int = 10


def split_lesson(
    lesson: Lesson,
    *,
    max_steps_per_part: int = DEFAULT_MAX_STEPS,
) -> list[Lesson]:
    """Split *lesson* into parts of at most *max_steps_per_part* steps.

    Returns ``[lesson]`` (the same object) when no split is needed.

    Args:
        lesson: The lesson to split.
        max_steps_per_part: Maximum number of steps per part (>= 1).

    Returns:
        A list of ``Lesson`` objects, one per part.

    Raises:
        ValueError: When *max_steps_per_part* < 1.
    """
    if max_steps_per_part < 1:
        raise ValueError(
            f"max_steps_per_part must be >= 1, got {max_steps_per_part}"
        )
    if len(lesson.steps) <= max_steps_per_part:
        return [lesson]

    chunks = _chunk_steps(lesson.steps, max_steps_per_part)
    total = len(chunks)
    card_by_id: dict[str, Card] = {c.id: c for c in lesson.cards}
    total_steps = len(lesson.steps)

    parts: list[Lesson] = []
    for idx, steps in enumerate(chunks):
        part_num = idx + 1
        referenced_ids = _collect_card_ids(steps)
        part_cards = [
            card_by_id[cid] for cid in referenced_ids if cid in card_by_id
        ]
        estimated_minutes = max(
            1,
            round((lesson.estimated_minutes * len(steps)) / total_steps),
        )
        # Build via model_copy to preserve validation; override only
        # the fields that change.
        part = lesson.model_copy(
            update={
                "id": f"{lesson.id}-part-{part_num}",
                "title": f"{lesson.title} - Part {part_num} of {total}",
                "cards": part_cards,
                "steps": list(steps),
                "estimated_minutes": estimated_minutes,
            }
        )
        parts.append(part)

    return parts


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _chunk_steps(
    steps: list[LessonStep],
    size: int,
) -> list[list[LessonStep]]:
    """Slice *steps* into consecutive chunks of at most *size* items."""
    return [steps[i : i + size] for i in range(0, len(steps), size)]


def _collect_card_ids(steps: list[LessonStep]) -> list[str]:
    """Return card IDs referenced by *steps*, in first-appearance order,
    deduplicated."""
    seen: set[str] = set()
    ids: list[str] = []
    for step in steps:
        if step.exercise is None:
            continue
        for cid in step.exercise.card_ids:
            if cid not in seen:
                seen.add(cid)
                ids.append(cid)
    return ids
