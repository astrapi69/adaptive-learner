"""ImportedConversation CRUD + analysis service (Phase 12C-D).

The analyze step lives in the frontend (browser-direct AI provider
calls); the backend only persists the result the frontend hands
back. This keeps the API-key surface client-side and matches the
Dexie-mode design.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable

from sqlalchemy.orm import Session, selectinload

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    ImportedConversation,
    ImportedMessage,
    LearningProject,
    LearningSession,
    User,
)
from app.schemas import (
    ImportedConversationAnalysis,
    ImportedConversationCreate,
    ImportedConversationUpdate,
)


def compute_content_hash(messages: Iterable[object]) -> str:
    """SHA-256 of the role-prefixed, content-stripped transcript.

    Per the Phase 36 Bug 1 contract (user-confirmed in the handover
    Q&A): each message renders as ``"{role.lower()}:{content.strip()}"``
    and the full transcript joins those lines with ``"\\n"``. Title
    is NOT part of the digest so re-imports with a fresh display
    title still detect as the same conversation.

    Accepts any iterable whose items have ``role`` + ``content``
    attributes. That covers Pydantic ``ImportedMessageIn``,
    SQLAlchemy ``ImportedMessage`` rows, and bare dataclasses /
    namedtuples — anything the import surface might hand it.

    The same algorithm runs in ``frontend/src/chat_import/content-hash.ts``
    and the Alembic 0014 back-fill; keep all three in lockstep.
    """
    parts: list[str] = []
    for msg in messages:
        role = getattr(msg, "role", None)
        if role is not None and hasattr(role, "value"):
            # Pydantic Enum field — unwrap the value.
            role = role.value
        content = getattr(msg, "content", None)
        if not isinstance(role, str) or not isinstance(content, str):
            raise TypeError("compute_content_hash: message must expose .role + .content as strings")
        parts.append(f"{role.lower()}:{content.strip()}")
    payload = "\n".join(parts)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _serialise_analysis(value: dict[str, object] | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _deserialise_analysis(raw: str | None) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        loaded = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return loaded if isinstance(loaded, dict) else None


def _to_dto(row: ImportedConversation) -> dict[str, object]:
    """Project the row to a dict the schema layer can validate.

    The wire shape exposes ``analysis_result`` as a dict; the DB
    stores JSON text. The router calls this before invoking
    ``ImportedConversationOut.model_validate``.
    """
    base: dict[str, object] = {
        "id": row.id,
        "user_id": row.user_id,
        "project_id": row.project_id,
        "source": row.source,
        "title": row.title,
        "message_count": row.message_count,
        "imported_at": row.imported_at,
        "analyzed": row.analyzed,
        "topic_tag": row.topic_tag,
        "model": row.model,
        "source_created_at": row.source_created_at,
        "analysis_result": _deserialise_analysis(row.analysis_result),
        "content_hash": row.content_hash,
        "source_language": row.source_language,
        "target_language": row.target_language,
    }
    return base


def to_out_dict(row: ImportedConversation) -> dict[str, object]:
    return _to_dto(row)


def to_detail_dict(row: ImportedConversation) -> dict[str, object]:
    dto = _to_dto(row)
    dto["messages"] = [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp,
            "order_index": m.order_index,
            # v1.8.0 / Phase 21D — added for sync surface inclusion.
            "created_at": m.created_at,
        }
        for m in row.messages
    ]
    return dto


def create_conversation(
    db: Session, user_id: str, payload: ImportedConversationCreate
) -> ImportedConversation:
    """Insert a new imported conversation + its messages.

    Validates user existence and (optional) project ownership. The
    message order is preserved by ``order_index``.

    Phase 36 Bug 1: computes a SHA-256 ``content_hash`` from the
    transcript (title-independent). If the same user already has a
    conversation with that hash, raises :class:`ConflictError`
    carrying the existing id in ``extra["existing_id"]`` so the
    frontend can navigate the user to the existing record.
    """
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    if payload.project_id is not None:
        project = db.get(LearningProject, payload.project_id)
        if project is None:
            raise NotFoundError(f"LearningProject {payload.project_id!r} not found.")
        if project.user_id != user_id:
            raise ValidationError(
                f"Project {payload.project_id!r} does not belong to user {user_id!r}."
            )
    content_hash = compute_content_hash(payload.messages)
    existing = (
        db.query(ImportedConversation)
        .filter(
            ImportedConversation.user_id == user_id,
            ImportedConversation.content_hash == content_hash,
        )
        .first()
    )
    if existing is not None:
        raise ConflictError(
            "Conversation already imported with the same content.",
            extra={"existing_id": existing.id},
        )
    conv = ImportedConversation(
        user_id=user_id,
        project_id=payload.project_id,
        source=payload.source.value,
        title=payload.title,
        message_count=len(payload.messages),
        topic_tag=payload.topic_tag,
        model=payload.model,
        source_created_at=payload.source_created_at,
        content_hash=content_hash,
        source_language=payload.source_language,
        target_language=payload.target_language,
    )
    db.add(conv)
    db.flush()  # so conv.id is populated for message FKs
    for idx, msg in enumerate(payload.messages):
        db.add(
            ImportedMessage(
                conversation_id=conv.id,
                role=msg.role.value,
                content=msg.content,
                timestamp=msg.timestamp,
                order_index=idx,
            )
        )
    db.commit()
    db.refresh(conv)
    return conv


def list_conversations(db: Session, user_id: str) -> list[ImportedConversation]:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return (
        db.query(ImportedConversation)
        .filter(ImportedConversation.user_id == user_id)
        .order_by(ImportedConversation.imported_at.desc())
        .all()
    )


def get_conversation(
    db: Session, conversation_id: str, *, with_messages: bool = False
) -> ImportedConversation:
    query = db.query(ImportedConversation).filter(ImportedConversation.id == conversation_id)
    if with_messages:
        query = query.options(selectinload(ImportedConversation.messages))
    conv = query.one_or_none()
    if conv is None:
        raise NotFoundError(f"ImportedConversation {conversation_id!r} not found.")
    return conv


def update_conversation(
    db: Session,
    conversation_id: str,
    payload: ImportedConversationUpdate,
) -> ImportedConversation:
    conv = get_conversation(db, conversation_id)
    fields = payload.model_dump(exclude_unset=True)
    if "project_id" in fields and fields["project_id"] is not None:
        project = db.get(LearningProject, fields["project_id"])
        if project is None:
            raise NotFoundError(f"LearningProject {fields['project_id']!r} not found.")
        if project.user_id != conv.user_id:
            raise ValidationError(
                f"Project {fields['project_id']!r} does not belong to user {conv.user_id!r}."
            )
    for key, value in fields.items():
        setattr(conv, key, value)
    db.commit()
    db.refresh(conv)
    return conv


def delete_conversation(db: Session, conversation_id: str) -> None:
    conv = get_conversation(db, conversation_id)
    db.delete(conv)
    db.commit()


def save_analysis(
    db: Session,
    conversation_id: str,
    payload: ImportedConversationAnalysis,
) -> ImportedConversation:
    """Persist the AI-analysis result blob.

    The frontend runs the analysis call (browser-direct AI provider)
    and POSTs the resulting JSON envelope here. Marks the row
    ``analyzed=True`` so the UI knows not to re-prompt.
    """
    conv = get_conversation(db, conversation_id)
    conv.analysis_result = _serialise_analysis(payload.analysis_result)
    conv.analyzed = True
    db.commit()
    db.refresh(conv)
    return conv


def get_active_session_for_conversation(
    db: Session, conversation_id: str
) -> LearningSession | None:
    """Most recent ``active`` session started from this conversation.

    Returns ``None`` when no active session exists. Validates the
    conversation exists first (raising ``NotFoundError`` otherwise),
    so the caller need not pre-check.

    Args:
        db: SQLAlchemy session.
        conversation_id: The imported conversation to look under.

    Returns:
        The newest active ``LearningSession`` for the conversation,
        or ``None``.
    """
    get_conversation(db, conversation_id)
    return (
        db.query(LearningSession)
        .filter(
            LearningSession.imported_conversation_id == conversation_id,
            LearningSession.status == "active",
        )
        .order_by(LearningSession.started_at.desc())
        .first()
    )


__all__ = [
    "compute_content_hash",
    "create_conversation",
    "delete_conversation",
    "get_active_session_for_conversation",
    "get_conversation",
    "list_conversations",
    "save_analysis",
    "to_detail_dict",
    "to_out_dict",
    "update_conversation",
]
