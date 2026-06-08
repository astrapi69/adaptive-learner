"""Repository for the ImportedConversation aggregate (EXP-024 pilot).

Holds every persistence primitive the ``imports`` service needs:
conversation + message CRUD, content-hash lookup, and the
active-session read used by the ImportDetail page. The abstract
:class:`ImportsRepository` is the contract the service depends on;
:class:`SqlAlchemyImportsRepository` is the SQLAlchemy implementation.

No validation, no domain errors, no HTTP -- those belong to
``app.services.imports``.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping, Sequence
from datetime import datetime

from sqlalchemy.orm import Session, selectinload

from app.models import (
    ImportedConversation,
    ImportedMessage,
    LearningProject,
    LearningSession,
    User,
)
from app.repositories.base import Repository


class ImportsRepository(Repository):
    """Persistence contract for imported conversations."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def get_project(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""

    @abstractmethod
    def find_by_content_hash(self, user_id: str, content_hash: str) -> ImportedConversation | None:
        """Return this user's conversation with the given hash, if any."""

    @abstractmethod
    def create_conversation(
        self,
        *,
        user_id: str,
        project_id: str | None,
        source: str,
        title: str,
        message_count: int,
        topic_tag: str | None,
        model: str | None,
        source_created_at: datetime | None,
        content_hash: str,
        source_language: str | None,
        target_language: str | None,
        messages: Sequence[Mapping[str, object]],
    ) -> ImportedConversation:
        """Insert a conversation and its ordered messages, then return it.

        ``messages`` items expose ``role``, ``content`` and (optional)
        ``timestamp`` keys; ``order_index`` is assigned by position.
        """

    @abstractmethod
    def list_by_user(self, user_id: str) -> list[ImportedConversation]:
        """Return the user's conversations, newest import first."""

    @abstractmethod
    def get_by_id(
        self, conversation_id: str, *, with_messages: bool = False
    ) -> ImportedConversation | None:
        """Return a conversation by id, optionally eager-loading messages."""

    @abstractmethod
    def apply_update(
        self, conv: ImportedConversation, fields: Mapping[str, object]
    ) -> ImportedConversation:
        """Set the given attributes, persist, and return the row."""

    @abstractmethod
    def delete(self, conv: ImportedConversation) -> None:
        """Delete a conversation (and cascade its messages)."""

    @abstractmethod
    def save_analysis(
        self, conv: ImportedConversation, analysis_text: str | None
    ) -> ImportedConversation:
        """Persist the serialized analysis blob and mark analyzed."""

    @abstractmethod
    def get_active_session_for_conversation(self, conversation_id: str) -> LearningSession | None:
        """Return the newest ``active`` session for the conversation."""


class SqlAlchemyImportsRepository(ImportsRepository):
    """SQLAlchemy-backed :class:`ImportsRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        return self._db.get(User, user_id)

    def get_project(self, project_id: str) -> LearningProject | None:
        return self._db.get(LearningProject, project_id)

    def find_by_content_hash(self, user_id: str, content_hash: str) -> ImportedConversation | None:
        return (
            self._db.query(ImportedConversation)
            .filter(
                ImportedConversation.user_id == user_id,
                ImportedConversation.content_hash == content_hash,
            )
            .first()
        )

    def create_conversation(
        self,
        *,
        user_id: str,
        project_id: str | None,
        source: str,
        title: str,
        message_count: int,
        topic_tag: str | None,
        model: str | None,
        source_created_at: datetime | None,
        content_hash: str,
        source_language: str | None,
        target_language: str | None,
        messages: Sequence[Mapping[str, object]],
    ) -> ImportedConversation:
        conv = ImportedConversation(
            user_id=user_id,
            project_id=project_id,
            source=source,
            title=title,
            message_count=message_count,
            topic_tag=topic_tag,
            model=model,
            source_created_at=source_created_at,
            content_hash=content_hash,
            source_language=source_language,
            target_language=target_language,
        )
        self._db.add(conv)
        self._db.flush()  # so conv.id is populated for message FKs
        for idx, msg in enumerate(messages):
            self._db.add(
                ImportedMessage(
                    conversation_id=conv.id,
                    role=msg["role"],
                    content=msg["content"],
                    timestamp=msg.get("timestamp"),
                    order_index=idx,
                )
            )
        self._db.commit()
        self._db.refresh(conv)
        return conv

    def list_by_user(self, user_id: str) -> list[ImportedConversation]:
        return (
            self._db.query(ImportedConversation)
            .filter(ImportedConversation.user_id == user_id)
            .order_by(ImportedConversation.imported_at.desc())
            .all()
        )

    def get_by_id(
        self, conversation_id: str, *, with_messages: bool = False
    ) -> ImportedConversation | None:
        query = self._db.query(ImportedConversation).filter(
            ImportedConversation.id == conversation_id
        )
        if with_messages:
            query = query.options(selectinload(ImportedConversation.messages))
        return query.one_or_none()

    def apply_update(
        self, conv: ImportedConversation, fields: Mapping[str, object]
    ) -> ImportedConversation:
        for key, value in fields.items():
            setattr(conv, key, value)
        self._db.commit()
        self._db.refresh(conv)
        return conv

    def delete(self, conv: ImportedConversation) -> None:
        self._db.delete(conv)
        self._db.commit()

    def save_analysis(
        self, conv: ImportedConversation, analysis_text: str | None
    ) -> ImportedConversation:
        conv.analysis_result = analysis_text
        conv.analyzed = True
        self._db.commit()
        self._db.refresh(conv)
        return conv

    def get_active_session_for_conversation(self, conversation_id: str) -> LearningSession | None:
        return (
            self._db.query(LearningSession)
            .filter(
                LearningSession.imported_conversation_id == conversation_id,
                LearningSession.status == "active",
            )
            .order_by(LearningSession.started_at.desc())
            .first()
        )


__all__ = ["ImportsRepository", "SqlAlchemyImportsRepository"]
