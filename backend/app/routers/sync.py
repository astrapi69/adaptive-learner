"""Cross-device sync router (Phase 13A).

Endpoints (all under ``/api/sync``):

  GET    /status?user_id=...                 -> row counts per table
  POST   /push                               -> apply incoming records
  POST   /pull                               -> stream out records
  POST   /resolve                            -> apply conflict decisions
  POST   /pair/generate                      -> mint a 5-min pairing token
  POST   /pair/verify                        -> consume a pairing token

The pairing token is the only auth on this surface. Once a phone
has paired (via the QR code or pasted link the desktop showed),
it knows the user_id and can call /push, /pull, /resolve scoped
to that id. This is a deliberately thin trust model: the
connection is local-network-only, the user is the same person on
both devices, and the threat model is "someone on the same WiFi"
not "the internet". The 5-min one-time token shrinks the attack
surface for that local-network adversary to near zero.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_sync_repo
from app.exceptions import NotFoundError, ValidationError
from app.repositories.sync_repo import SyncRepository
from app.schemas import UserOut
from app.services import pairing as pairing_service
from app.services import sync_service
from app.services.sync_service import (
    ALL_SYNC_TABLES,
    Resolution,
    apply_resolutions,
    compute_status,
    pull_records,
    push_records,
)

router = APIRouter(prefix="/sync", tags=["sync"])


# ---------------------------------------------------------------------------
# Request / response shapes
# ---------------------------------------------------------------------------


class PushBody(BaseModel):
    table: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    records: list[dict[str, Any]] = Field(default_factory=list)
    since: str | None = None


class PushResponse(BaseModel):
    accepted: list[str]
    conflicts: list[dict[str, Any]]
    skipped: list[str]


class PullBody(BaseModel):
    user_id: str = Field(min_length=1)
    tables: list[str] | None = None
    since: str | None = None


class PullResponse(BaseModel):
    records: dict[str, list[dict[str, Any]]]


class ResolutionEntry(BaseModel):
    table: str
    record_id: str = Field(alias="id")
    chosen: str  # "local" | "remote" | "merged"
    merged_data: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class ResolveBody(BaseModel):
    user_id: str = Field(min_length=1)
    resolutions: list[ResolutionEntry]


class ResolveResponse(BaseModel):
    applied: list[str]
    skipped: list[str]


class PairGenerateBody(BaseModel):
    user_id: str = Field(min_length=1)


class PairGenerateResponse(BaseModel):
    token: str
    user_id: str
    user_name: str
    expires_at: str


class PairVerifyBody(BaseModel):
    token: str = Field(min_length=1)


class PairVerifyResponse(BaseModel):
    user_id: str
    user: UserOut


class StatusResponse(BaseModel):
    user_id: str
    counts: dict[str, int]
    server_time: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status", response_model=StatusResponse)
def sync_status(user_id: str, repo: SyncRepository = Depends(get_sync_repo)) -> StatusResponse:
    summary = compute_status(repo, user_id)
    return StatusResponse(**summary)


@router.post("/push", response_model=PushResponse)
def sync_push(payload: PushBody, repo: SyncRepository = Depends(get_sync_repo)) -> PushResponse:
    if payload.table not in sync_service.TABLES:
        raise ValidationError(f"Unknown sync table: {payload.table!r}")
    since = sync_service._from_iso(payload.since) if payload.since else None
    outcome = push_records(
        repo,
        user_id=payload.user_id,
        table=payload.table,
        records=payload.records,
        since=since,
    )
    return PushResponse(
        accepted=outcome.accepted,
        conflicts=[
            {
                "table": c.table,
                "id": c.record_id,
                "local": c.local,
                "remote": c.remote,
            }
            for c in outcome.conflicts
        ],
        skipped=outcome.skipped,
    )


@router.post("/pull", response_model=PullResponse)
def sync_pull(payload: PullBody, repo: SyncRepository = Depends(get_sync_repo)) -> PullResponse:
    tables = tuple(payload.tables) if payload.tables else ALL_SYNC_TABLES
    unknown = [t for t in tables if t not in sync_service.TABLES]
    if unknown:
        raise ValidationError(f"Unknown sync tables: {unknown}")
    since = sync_service._from_iso(payload.since) if payload.since else None
    records = pull_records(repo, payload.user_id, tables, since)
    return PullResponse(records=records)


@router.post("/resolve", response_model=ResolveResponse)
def sync_resolve(
    payload: ResolveBody, repo: SyncRepository = Depends(get_sync_repo)
) -> ResolveResponse:
    resolutions = [
        Resolution(
            table=r.table,
            record_id=r.record_id,
            chosen=r.chosen,
            merged_data=r.merged_data,
        )
        for r in payload.resolutions
    ]
    outcome = apply_resolutions(repo, payload.user_id, resolutions)
    return ResolveResponse(**outcome)


@router.post(
    "/pair/generate",
    response_model=PairGenerateResponse,
    status_code=status.HTTP_201_CREATED,
)
def pair_generate(payload: PairGenerateBody, db: Session = Depends(get_db)) -> PairGenerateResponse:
    """Mint a one-time pairing token for the desktop side.

    The desktop calls this when the user clicks "Pair device".
    Token + IP + port get rendered into a QR code (and shown as
    a paste-the-link string) for the phone to consume.
    """
    from app.models import User as UserModel

    user = db.get(UserModel, payload.user_id)
    if user is None:
        raise NotFoundError(f"User {payload.user_id!r} not found.")
    token = pairing_service.generate_token(user.id, user.name)
    return PairGenerateResponse(
        token=token.token,
        user_id=token.user_id,
        user_name=token.user_name,
        expires_at=token.expires_at.isoformat(),
    )


@router.post("/pair/verify", response_model=PairVerifyResponse)
def pair_verify(payload: PairVerifyBody, db: Session = Depends(get_db)) -> PairVerifyResponse:
    """Consume the pairing token from the phone side.

    Returns the user object so the phone can mirror the
    desktop's identity locally — the next sync calls use this
    same user_id.
    """
    from app.models import User as UserModel

    token = pairing_service.verify_token(payload.token)
    if token is None:
        raise NotFoundError("Pairing token is invalid, expired, or already used.")
    user = db.get(UserModel, token.user_id)
    if user is None:
        # The user was deleted between token-mint and verify.
        # Defensive — should not happen in practice.
        raise NotFoundError(f"User {token.user_id!r} not found.")
    return PairVerifyResponse(
        user_id=user.id,
        user=UserOut.model_validate(user),
    )
