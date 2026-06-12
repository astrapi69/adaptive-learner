"""FastAPI routes for the Anki plugin (Phase 30).

  GET    /api/plugins/anki/cards/{user_id}                   list (with filters)
  POST   /api/plugins/anki/cards                              manual insert
  PATCH  /api/plugins/anki/cards/{card_id}                    inline edit / accept / reject
  DELETE /api/plugins/anki/cards/{card_id}                    delete suggestion
  POST   /api/plugins/anki/cards/extract/session/{session_id} AI extract from session
  POST   /api/plugins/anki/cards/extract/conversation/{conversation_id}  AI + vocab extract
  POST   /api/plugins/anki/cards/mark-exported                bulk-mark accepted cards as exported
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import AnkiCardSuggestion, User
from app.schemas import (
    AnkiCardSuggestionCreate,
    AnkiCardSuggestionOut,
    AnkiCardSuggestionUpdate,
)
from app.services.ai_caller import build_ai_caller

from . import card_extraction

router = APIRouter(prefix="/plugins/anki", tags=["anki"])
logger = logging.getLogger(__name__)


def _to_out(row: AnkiCardSuggestion) -> AnkiCardSuggestionOut:
    """Decode the JSON ``tags`` column when serialising out."""
    try:
        tags = json.loads(row.tags) if row.tags else []
    except (TypeError, json.JSONDecodeError):
        tags = []
    return AnkiCardSuggestionOut(
        id=row.id,
        user_id=row.user_id,
        session_id=row.session_id,
        conversation_id=row.conversation_id,
        project_id=row.project_id,
        card_type=row.card_type,
        front=row.front,
        back=row.back,
        tags=tags if isinstance(tags, list) else [],
        accepted=row.accepted,
        rejected=row.rejected,
        exported_at=row.exported_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _ensure_user(db: Session, user_id: str) -> None:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")


def _get_card(db: Session, card_id: str) -> AnkiCardSuggestion:
    row = db.get(AnkiCardSuggestion, card_id)
    if row is None:
        raise NotFoundError(f"AnkiCardSuggestion {card_id!r} not found.")
    return row


# ---------------------------------------------------------------------------
# List + CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/cards/{user_id}", response_model=list[AnkiCardSuggestionOut]
)
def list_cards(
    user_id: str,
    project_id: str | None = None,
    accepted_only: bool = False,
    include_rejected: bool = False,
    db: Session = Depends(get_db),
) -> list[AnkiCardSuggestionOut]:
    """Filterable card list for the review + export UI."""
    _ensure_user(db, user_id)
    q = db.query(AnkiCardSuggestion).filter(
        AnkiCardSuggestion.user_id == user_id
    )
    if project_id is not None:
        q = q.filter(AnkiCardSuggestion.project_id == project_id)
    if accepted_only:
        q = q.filter(AnkiCardSuggestion.accepted.is_(True))
    if not include_rejected:
        q = q.filter(AnkiCardSuggestion.rejected.is_(False))
    rows = q.order_by(AnkiCardSuggestion.created_at.desc()).all()
    return [_to_out(r) for r in rows]


@router.post("/cards", response_model=AnkiCardSuggestionOut)
def create_card(
    body: AnkiCardSuggestionCreate,
    user_id: str,
    db: Session = Depends(get_db),
) -> AnkiCardSuggestionOut:
    """Manual card insert (the user can write their own without
    invoking the extractor)."""
    _ensure_user(db, user_id)
    if body.card_type not in ("basic", "cloze"):
        raise ValidationError(
            f"card_type must be 'basic' or 'cloze' (got {body.card_type!r})."
        )
    row = AnkiCardSuggestion(
        user_id=user_id,
        session_id=body.session_id,
        conversation_id=body.conversation_id,
        project_id=body.project_id,
        card_type=body.card_type,
        front=body.front,
        back=body.back,
        tags=json.dumps(body.tags, ensure_ascii=False),
        accepted=body.accepted,
        rejected=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.patch(
    "/cards/{card_id}", response_model=AnkiCardSuggestionOut
)
def update_card(
    card_id: str,
    body: AnkiCardSuggestionUpdate,
    db: Session = Depends(get_db),
) -> AnkiCardSuggestionOut:
    """Inline edit + accept/reject toggle. Setting ``accepted=True``
    clears ``rejected``; setting ``rejected=True`` clears
    ``accepted``."""
    row = _get_card(db, card_id)
    if body.card_type is not None:
        if body.card_type not in ("basic", "cloze"):
            raise ValidationError(
                f"card_type must be 'basic' or 'cloze' (got {body.card_type!r})."
            )
        row.card_type = body.card_type
    if body.front is not None:
        row.front = body.front
    if body.back is not None:
        row.back = body.back
    if body.tags is not None:
        row.tags = json.dumps(body.tags, ensure_ascii=False)
    # Accept + reject are mutually exclusive. If the body sets
    # BOTH to True (shouldn't happen in normal UI flow but tests
    # for it), accept wins because it's the positive action and
    # the user explicitly opted in.
    if body.accepted is True:
        row.accepted = True
        row.rejected = False
    elif body.rejected is True:
        row.rejected = True
        row.accepted = False
    else:
        if body.accepted is False:
            row.accepted = False
        if body.rejected is False:
            row.rejected = False
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.delete("/cards/{card_id}")
def delete_card(
    card_id: str, db: Session = Depends(get_db)
) -> dict[str, Any]:
    row = _get_card(db, card_id)
    db.delete(row)
    db.commit()
    return {"deleted": card_id}


# ---------------------------------------------------------------------------
# AI extraction
# ---------------------------------------------------------------------------


@router.post(
    "/cards/extract/session/{session_id}",
    response_model=list[AnkiCardSuggestionOut],
)
def extract_session_cards(
    session_id: str, db: Session = Depends(get_db)
) -> list[AnkiCardSuggestionOut]:
    """Run the extractor against a completed session's transcript.

    Resolves the session's owner user, fires the active provider's
    ``ai_complete`` with a JSON-emitting prompt, persists the
    parsed cards as ``accepted=False`` rows. Returns the new rows
    so the frontend can append them to the review list without a
    second roundtrip.
    """
    transcript, user_id, _ = card_extraction._session_transcript(
        db, session_id
    )
    if user_id is None:
        raise NotFoundError(f"LearningSession {session_id!r} not found.")
    if not transcript.strip():
        # No messages → nothing to extract; non-error path.
        return []
    ai_call = build_ai_caller(db, user_id, max_tokens=512)
    rows = card_extraction.extract_from_session(db, session_id, ai_call)
    return [_to_out(r) for r in rows]


@router.post(
    "/cards/extract/conversation/{conversation_id}",
    response_model=list[AnkiCardSuggestionOut],
)
def extract_conversation_cards(
    conversation_id: str, db: Session = Depends(get_db)
) -> list[AnkiCardSuggestionOut]:
    """Build cards from an imported conversation.

    Vocabulary path (no AI cost) runs first; if it produced
    cards, the AI hook never fires and the user's missing
    provider / api_key isn't a blocker. AI extractor runs only
    when no vocabulary was extracted — and is built LAZILY so
    we don't 400 the vocabulary-only happy path.
    """
    transcript, user_id, _, analysis = (
        card_extraction._conversation_transcript(db, conversation_id)
    )
    if user_id is None:
        raise NotFoundError(
            f"ImportedConversation {conversation_id!r} not found."
        )

    # Lazy AI caller: only built if the vocabulary path comes up
    # empty AND there's a transcript to feed the model. Raises
    # ValidationError if the user has no provider configured —
    # propagated as 400 by the global exception handler.
    needs_ai_box: list[bool] = [False]

    def _ai(messages: list[dict[str, str]]) -> str | None:
        needs_ai_box[0] = True
        caller = build_ai_caller(db, user_id, max_tokens=512)
        return caller(messages)

    rows = card_extraction.extract_from_conversation(
        db, conversation_id, _ai
    )
    return [_to_out(r) for r in rows]


# ---------------------------------------------------------------------------
# Mark-exported (called from the frontend after a successful download)
# ---------------------------------------------------------------------------


class _MarkExportedBody(BaseModel):
    card_ids: list[str]


@router.post("/cards/mark-exported")
def mark_exported(
    body: _MarkExportedBody, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Bulk-stamp ``exported_at`` on the given card ids.

    Called after the frontend successfully wrote the .apkg blob
    to the user's downloads. Skipped silently for unknown ids so
    a re-export of a now-deleted card doesn't 404 the whole call.
    """
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    updated = 0
    for cid in body.card_ids:
        row = db.get(AnkiCardSuggestion, cid)
        if row is None:
            continue
        row.exported_at = now
        updated += 1
    db.commit()
    return {"updated": updated}
