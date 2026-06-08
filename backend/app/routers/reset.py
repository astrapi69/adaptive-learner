"""Reset router (Phase 41F Danger Zone).

Single endpoint: ``POST /api/reset``. The body MUST carry an exact
``"RESET"`` confirmation token, matching the typed-confirmation
flow the Settings Danger Zone uses (same shape as GitHub repo
deletion). Anything else 400s before the service runs.

Service-side details (table truncation, identity.yaml + secrets
scrubbing, what survives) live in
:mod:`app.services.reset_service`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.deps import get_reset_repo
from app.repositories.reset_repo import ResetRepository
from app.services import reset_service

router = APIRouter(prefix="/reset", tags=["reset"])


class ResetRequest(BaseModel):
    """POST /api/reset body. The confirmation token MUST match
    :data:`reset_service.CONFIRMATION_TOKEN` exactly (case-
    sensitive, no extra whitespace). Pydantic does no special
    validation here - the equality check happens in the handler
    so the error path is one place, easy to grep, easy to test.
    """

    confirmation: str = Field(
        ...,
        description="Must equal the literal string 'RESET'.",
    )


class ResetResult(BaseModel):
    """POST /api/reset success payload."""

    reset: bool
    tables_cleared: int


@router.post("", response_model=ResetResult)
def reset(
    payload: ResetRequest,
    repo: ResetRepository = Depends(get_reset_repo),
) -> ResetResult:
    """Wipe every learner row + every identity / API-key trace.

    Returns 400 if the confirmation token doesn't match exactly
    (the typed-confirmation gate). Returns 200 with the count of
    tables truncated on success. The frontend is responsible for
    clearing localStorage / sessionStorage and redirecting to the
    Landing page after the response.
    """
    if payload.confirmation != reset_service.CONFIRMATION_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation token mismatch.",
        )
    count = reset_service.reset_all(repo)
    return ResetResult(reset=True, tables_cleared=count)
