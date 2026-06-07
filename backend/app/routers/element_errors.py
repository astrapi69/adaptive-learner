"""Element-error router (Phase 46B / C6 / P-129).

  POST  /api/users/{user_id}/element-errors                  → bulk upsert
  GET   /api/users/{user_id}/element-errors                  → list (debug + C11 source)

Routes mirror the canonical /users/{user_id}/* shape used by
the sibling lesson-progress + tracking routes. Thin per the
architecture rule: validate user existence, delegate to
``app.services.element_errors``, serialise out via Pydantic.

The bulk-upsert endpoint is the only write surface. The
review-queue endpoint (C11) lives in the tools plugin and
reads via ``element_errors_service.list_for_user`` directly
— no separate write paths from the SRS side.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.deps import get_element_errors_repo
from app.exceptions import NotFoundError
from app.repositories.element_errors_repo import ElementErrorsRepository
from app.schemas import (
    ElementAttemptsIn,
    ElementErrorOut,
    ReviewQueueItemOut,
)
from app.services import element_errors as element_errors_service
from app.services import element_srs as element_srs_service

router = APIRouter(prefix="/users", tags=["element-errors"])


def _require_user(repo: ElementErrorsRepository, user_id: str) -> None:
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id} not found")


@router.get(
    "/{user_id}/element-errors",
    response_model=list[ElementErrorOut],
)
def list_element_errors(
    user_id: str,
    set_id: str | None = Query(
        default=None,
        description=(
            "Optional content-set filter. Omit to read across all sets the user has touched."
        ),
    ),
    include_mastered: bool = Query(
        default=True,
        description=(
            "Set to false to read only the SRS-active rows "
            "(mastered elements are excluded from review)."
        ),
    ),
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> list[ElementErrorOut]:
    _require_user(repo, user_id)
    rows = element_errors_service.list_for_user(
        repo,
        user_id,
        set_id=set_id,
        include_mastered=include_mastered,
    )
    return [ElementErrorOut.model_validate(row) for row in rows]


@router.get(
    "/{user_id}/element-errors/review-queue",
    response_model=list[ReviewQueueItemOut],
)
def review_queue(
    user_id: str,
    set_id: str | None = Query(
        default=None,
        description=(
            "Optional content-set filter. Omit to read the "
            "review queue across all sets the user has touched."
        ),
    ),
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> list[ReviewQueueItemOut]:
    """SRS review queue for the user (Phase 46C / P-129).

    Returns active (non-mastered) element-error rows
    projected into review items with computed
    ``suggested_review_at`` + ``overdue`` fields. Sorted by
    overdue → error_count desc → last_error_at desc so the
    Dashboard widget (C13) renders the most urgent items
    first.
    """
    _require_user(repo, user_id)
    items = element_srs_service.compute_review_queue(
        repo,
        user_id,
        set_id=set_id,
    )
    return [ReviewQueueItemOut.model_validate(item) for item in items]


@router.post(
    "/{user_id}/element-errors",
    response_model=list[ElementErrorOut],
)
def record_element_attempts(
    user_id: str,
    payload: ElementAttemptsIn,
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> list[ElementErrorOut]:
    """Bulk upsert; preserves input order in the response.

    The viewer's per-step recordStepResult hook (C10) calls
    this once per exercise submit with the attempts the
    exercise-side deriver produced. Per the Pydantic schema
    in C4 the body caps at 100 attempts per call."""
    _require_user(repo, user_id)
    rows = element_errors_service.record_attempts(
        repo,
        user_id,
        payload.attempts,
    )
    repo.commit()
    return [ElementErrorOut.model_validate(row) for row in rows]
