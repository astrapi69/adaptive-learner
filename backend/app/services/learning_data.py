"""Learner-data maintenance service (#1821, API-mode half of #1445 Part B).

One atomic, user-scoped delete spanning BOTH learner-data aggregates:
lesson-progress rows (by row id) and element-error/SRS rows (by set
id). Mirrors the Dexie-side ``deleteLearningData`` so the repo-removal
opt-in delete works identically in server mode.

The two repositories share the request-scoped session (FastAPI caches
``get_db``), so the single ``commit`` at the end makes the cross-table
delete atomic - no half state.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.exceptions import NotFoundError
from app.repositories.element_errors_repo import ElementErrorsRepository
from app.repositories.lesson_progress_repo import LessonProgressRepository


@dataclass(frozen=True)
class LearningDataDeletion:
    """What to delete: specific progress rows + review cards.

    Cards are addressed either by whole ``set_ids`` or, for a single-lesson
    delete (#2064), by exact ``(set_id, lesson_id)`` pairs in ``lesson_cards``.
    """

    lesson_progress_ids: list[str]
    set_ids: list[str]
    lesson_cards: list[tuple[str, str]] = field(default_factory=list)


@dataclass(frozen=True)
class LearningDataDeletionResult:
    """The real per-table counts removed."""

    lessons_deleted: int
    cards_deleted: int


def delete_learning_data(
    progress_repo: LessonProgressRepository,
    errors_repo: ElementErrorsRepository,
    user_id: str,
    deletion: LearningDataDeletion,
) -> LearningDataDeletionResult:
    """Atomically delete the given progress rows + set-scoped review cards.

    Args:
        progress_repo: lesson-progress persistence, bound to the request
            session.
        errors_repo: element-error persistence, bound to the SAME session.
        user_id: owner scope; foreign users' rows are never touched.
        deletion: row ids + set ids to remove. Unknown ids are a
            zero-count no-op, never an error.

    Returns:
        The per-table counts actually removed.

    Raises:
        NotFoundError: when ``user_id`` does not exist.
    """
    if progress_repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id} not found")
    lessons_deleted = progress_repo.delete_by_ids(user_id, deletion.lesson_progress_ids)
    cards_deleted = errors_repo.delete_by_set_ids(user_id, deletion.set_ids)
    cards_deleted += errors_repo.delete_by_lessons(user_id, deletion.lesson_cards)
    progress_repo.commit()
    return LearningDataDeletionResult(
        lessons_deleted=lessons_deleted,
        cards_deleted=cards_deleted,
    )
