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

from app.deps import get_element_errors_repo, get_set_runs_repo
from app.exceptions import NotFoundError
from app.repositories.element_errors_repo import ElementErrorsRepository
from app.repositories.set_runs_repo import SetRunsRepository
from app.schemas import (
    ArchiveRetiredIn,
    ArchiveRetiredResult,
    ElementAttemptsIn,
    ElementErrorOut,
    ElementKeyRemapResult,
    ElementKeyRemapsIn,
    ExerciseIdRemapsIn,
    ReviewQueueItemOut,
    SetRunOut,
    StartRunIn,
)
from app.services import element_errors as element_errors_service
from app.services import element_srs as element_srs_service
from app.services import set_runs as set_runs_service

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
    include_retired: bool = Query(
        default=False,
        description=(
            "Set to true to include archived rows (#2188 author-retired "
            "identities). Excluded by default so archived progress leaves "
            "scheduling + due counts."
        ),
    ),
    run_id: int | None = Query(
        default=None,
        ge=1,
        description=(
            "EXP-051 / #2125 — the Durchgang (run/pass) to read. Omit for "
            "each set's ACTIVE run (current state); pass a run number to read "
            "a specific past run for the Fehlerhistorie."
        ),
    ),
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> list[ElementErrorOut]:
    """List the user's element-error rows, optionally filtered by set, mastery
    state, and Durchgang."""
    _require_user(repo, user_id)
    rows = element_errors_service.list_for_user(
        repo,
        user_id,
        set_id=set_id,
        include_mastered=include_mastered,
        include_retired=include_retired,
        run_id=run_id,
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
    limit: int | None = Query(
        default=None,
        ge=0,
        description=(
            "#603 - cap the returned items (a review session uses "
            "MAX_REVIEW_SESSION=20). Omit for the full queue (the "
            "'N due' count)."
        ),
    ),
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> list[ReviewQueueItemOut]:
    """SRS review queue for the user (Phase 46C / P-129; #603).

    Returns active (non-mastered) element-error rows projected into
    review items with computed ``suggested_review_at`` + ``overdue``
    fields. Sorted by overdue → weakness tier (wrong > almost-right >
    correct) → error frequency → oldest error first, capped at
    ``limit`` when given, so the review session stays focused.
    """
    _require_user(repo, user_id)
    items = element_srs_service.compute_review_queue(
        repo,
        user_id,
        set_id=set_id,
        limit=limit,
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
    set_runs_repo: SetRunsRepository = Depends(get_set_runs_repo),
) -> list[ElementErrorOut]:
    """Bulk upsert; preserves input order in the response.

    The viewer's per-step recordStepResult hook (C10) calls
    this once per exercise submit with the attempts the
    exercise-side deriver produced. Per the Pydantic schema
    in C4 the body caps at 100 attempts per call.

    Each attempt is recorded under its set's active Durchgang (EXP-051 /
    #2125). ``repo`` and ``set_runs_repo`` share the request session, so
    the lazy run-1 materialisation and the attempt rows commit together."""
    _require_user(repo, user_id)
    rows = element_errors_service.record_attempts(
        repo,
        user_id,
        payload.attempts,
        set_runs_repo=set_runs_repo,
    )
    repo.commit()
    return [ElementErrorOut.model_validate(row) for row in rows]


@router.post(
    "/{user_id}/element-errors/remap",
    response_model=ElementKeyRemapResult,
)
def remap_element_keys(
    user_id: str,
    payload: ElementKeyRemapsIn,
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> ElementKeyRemapResult:
    """One-off ja/ko/zh recovery (#2161): rewrite orphaned ``element_key``
    values old -> new for this user. Idempotent + no double-map (a target that
    already exists is skipped); all remaps in the call land atomically. The
    client sends one set's remaps per call and only after verifying each
    ``new`` key exists in the current content."""
    _require_user(repo, user_id)
    applied, skipped = element_errors_service.remap_element_keys(
        repo,
        user_id,
        [(r.set_id, r.lesson_id, r.exercise_id, r.old, r.new) for r in payload.remaps],
    )
    return ElementKeyRemapResult(applied=applied, skipped=skipped)


@router.post(
    "/{user_id}/element-errors/remap-exercise-ids",
    response_model=ElementKeyRemapResult,
)
def remap_exercise_ids(
    user_id: str,
    payload: ExerciseIdRemapsIn,
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> ElementKeyRemapResult:
    """#2130 stable_id key switch: rewrite ``exercise_id`` old -> new for
    every row of the exercise (all element_keys + both drill directions).
    Idempotent + no double-map (a target row that already exists is skipped);
    all remaps in the call land atomically. The client derives the mapping
    locally from the lesson files (authored id -> ``stable_id``, both present
    in the same file) and sends one set's remaps per call."""
    _require_user(repo, user_id)
    applied, skipped = element_errors_service.remap_exercise_ids(
        repo,
        user_id,
        [(r.set_id, r.lesson_id, r.old, r.new) for r in payload.remaps],
    )
    return ElementKeyRemapResult(applied=applied, skipped=skipped)


@router.post(
    "/{user_id}/element-errors/archive-retired",
    response_model=ArchiveRetiredResult,
)
def archive_retired(
    user_id: str,
    payload: ArchiveRetiredIn,
    repo: ElementErrorsRepository = Depends(get_element_errors_repo),
) -> ArchiveRetiredResult:
    """#2188: archive the learner's rows for identities the author retired
    via the set manifest's ``retired_ids``. Archived rows keep their history
    but leave review scheduling + due counts. Idempotent (already-archived
    rows are not re-counted); one call is one transaction."""
    _require_user(repo, user_id)
    archived = element_errors_service.archive_retired(
        repo, user_id, payload.set_id, payload.retired_ids
    )
    return ArchiveRetiredResult(archived=archived)


def _require_user_for_runs(repo: SetRunsRepository, user_id: str) -> None:
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id} not found")


@router.get(
    "/{user_id}/set-runs",
    response_model=list[SetRunOut],
)
def list_set_runs(
    user_id: str,
    set_id: str = Query(
        ...,
        min_length=1,
        description="The content set whose Durchgänge (runs) to list.",
    ),
    repo: SetRunsRepository = Depends(get_set_runs_repo),
) -> list[SetRunOut]:
    """List every Durchgang (run/pass) of a set for the user, oldest first
    (EXP-051 / #2125). The active run has ``closed_at = null``. The
    Fehlerhistorie enumerates runs here, then reads each run's rows via the
    ``run_id`` filter on the element-errors list."""
    _require_user_for_runs(repo, user_id)
    return [
        SetRunOut.model_validate(row) for row in set_runs_service.list_runs(repo, user_id, set_id)
    ]


@router.post(
    "/{user_id}/set-runs",
    response_model=SetRunOut,
)
def start_set_run(
    user_id: str,
    payload: StartRunIn,
    repo: SetRunsRepository = Depends(get_set_runs_repo),
) -> SetRunOut:
    """Start a new Durchgang of a set ("Set erneut durcharbeiten", #2125).

    Atomically closes the current active run and opens the next: the prior
    run's element-error rows stay frozen under their ``run_id`` for the
    Fehlerhistorie, and new attempts write fresh rows under the new run
    (cold SRS scheduling). Returns the newly opened run."""
    _require_user_for_runs(repo, user_id)
    new_run = set_runs_service.start_new_run(
        repo,
        user_id,
        payload.set_id,
        content_version=payload.content_version,
    )
    return SetRunOut.model_validate(new_run)
