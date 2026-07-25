"""Learner-data maintenance router (#1821).

  POST /api/users/{user_id}/learning-data/delete -> atomic delete of
  lesson-progress rows (by id) + element-error/SRS rows (by set id)

API-mode half of the #1445 Part B repo-removal opt-in delete. Thin per
the architecture rule: validate via the service, delegate, serialise.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import get_element_errors_repo, get_lesson_progress_repo
from app.repositories.element_errors_repo import ElementErrorsRepository
from app.repositories.lesson_progress_repo import LessonProgressRepository
from app.schemas import LearningDataDeleteIn, LearningDataDeleteOut
from app.services import learning_data as learning_data_service

router = APIRouter(prefix="/users", tags=["learning-data"])


@router.post(
    "/{user_id}/learning-data/delete",
    response_model=LearningDataDeleteOut,
)
def delete_learning_data(
    user_id: str,
    payload: LearningDataDeleteIn,
    progress_repo: LessonProgressRepository = Depends(get_lesson_progress_repo),
    errors_repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> LearningDataDeleteOut:
    """Atomically delete the given progress rows + set-scoped review cards."""
    result = learning_data_service.delete_learning_data(
        progress_repo,
        errors_repo,
        user_id,
        learning_data_service.LearningDataDeletion(
            lesson_progress_ids=payload.lesson_progress_ids,
            set_ids=payload.set_ids,
            lesson_cards=[(c.set_id, c.lesson_id) for c in payload.lesson_cards],
        ),
    )
    return LearningDataDeleteOut(
        lessons_deleted=result.lessons_deleted,
        cards_deleted=result.cards_deleted,
    )
