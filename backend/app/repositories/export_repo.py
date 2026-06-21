"""Repository for the export aggregation reads (Phase 16A; EXP-024 Phase 1).

The export service is a pure, read-only aggregator. This repository
owns every SQLAlchemy read it performs; the DTO shaping, tree
flattening, and envelope construction stay in
``app.services.export_service``. No writes, no commits.
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy.orm import Session

from app.models import (
    Curriculum,
    ImportedConversation,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    MethodSwitch,
    ProgressCommit,
    SessionMessage,
    SessionRating,
    StepEvaluation,
    User,
)
from app.repositories.base import Repository


class ExportRepository(Repository):
    """Read contract for the export aggregator."""

    # --- progress report ---------------------------------------------------
    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def list_projects_by_user(self, user_id: str) -> list[LearningProject]:
        """Return the user's projects, oldest-created first."""

    @abstractmethod
    def list_projects_by_ids(self, project_ids: list[str]) -> list[LearningProject]:
        """Return the projects matching the given ids (empty list if none)."""

    @abstractmethod
    def latest_profile(self, user_id: str) -> LearningProfile | None:
        """Return the user's most recently assessed profile, or ``None``."""

    @abstractmethod
    def list_commits_for_project(self, project_id: str) -> list[ProgressCommit]:
        """Return the project's progress commits, oldest first."""

    @abstractmethod
    def list_method_switches_for_project(self, project_id: str) -> list[MethodSwitch]:
        """Return the project's method switches, oldest first."""

    @abstractmethod
    def list_recent_sessions(self, project_ids: list[str], *, limit: int) -> list[LearningSession]:
        """Return the most recent sessions across the projects, newest first, capped at ``limit``."""

    @abstractmethod
    def list_sessions_for_projects(self, project_ids: list[str]) -> list[LearningSession]:
        """Return every session belonging to the given projects (empty list if none)."""

    @abstractmethod
    def list_ratings_for_sessions(self, session_ids: list[str]) -> list[SessionRating]:
        """Return all ratings for the given sessions, newest first (empty list if none)."""

    @abstractmethod
    def list_step_evaluations_for_sessions(self, session_ids: list[str]) -> list[StepEvaluation]:
        """Return all step evaluations for the given sessions (empty list if none)."""

    @abstractmethod
    def list_analyzed_conversations(self, user_id: str) -> list[ImportedConversation]:
        """Return the user's analyzed imported conversations, newest import first."""

    # --- session detail ----------------------------------------------------
    @abstractmethod
    def get_session(self, session_id: str) -> LearningSession | None:
        """Return the session row, or ``None`` when it does not exist."""

    @abstractmethod
    def get_project(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""

    @abstractmethod
    def list_messages_for_session(self, session_id: str) -> list[SessionMessage]:
        """Return the session's messages, oldest first."""

    @abstractmethod
    def latest_rating_for_session(self, session_id: str) -> SessionRating | None:
        """Return the session's most recent rating, or ``None``."""

    @abstractmethod
    def list_step_evaluations_for_session(self, session_id: str) -> list[StepEvaluation]:
        """Return the session's step evaluations, oldest first."""

    # --- curriculum overview ----------------------------------------------
    @abstractmethod
    def get_curriculum(self, curriculum_id: str) -> Curriculum | None:
        """Return the curriculum row, or ``None`` when it does not exist."""

    @abstractmethod
    def list_topics_for_curriculum(self, curriculum_id: str) -> list[LearningTopic]:
        """Return the curriculum's topics, ordered by index then creation."""

    @abstractmethod
    def list_lessons_for_curriculum(self, curriculum_id: str) -> list[Lesson]:
        """Return the curriculum's lessons, ordered by index then creation."""


class SqlAlchemyExportRepository(ExportRepository):
    """SQLAlchemy-backed :class:`ExportRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # --- progress report ---------------------------------------------------
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""
        return self._db.query(User).filter(User.id == user_id).first()

    def list_projects_by_user(self, user_id: str) -> list[LearningProject]:
        """Return the user's projects, oldest-created first."""
        return (
            self._db.query(LearningProject)
            .filter(LearningProject.user_id == user_id)
            .order_by(LearningProject.created_at.asc())
            .all()
        )

    def list_projects_by_ids(self, project_ids: list[str]) -> list[LearningProject]:
        """Return the projects matching the given ids (empty list if none)."""
        if not project_ids:
            return []
        return self._db.query(LearningProject).filter(LearningProject.id.in_(project_ids)).all()

    def latest_profile(self, user_id: str) -> LearningProfile | None:
        """Return the user's most recently assessed profile, or ``None``."""
        return (
            self._db.query(LearningProfile)
            .filter(LearningProfile.user_id == user_id)
            .order_by(LearningProfile.assessed_at.desc())
            .first()
        )

    def list_commits_for_project(self, project_id: str) -> list[ProgressCommit]:
        """Return the project's progress commits, oldest first."""
        return (
            self._db.query(ProgressCommit)
            .filter(ProgressCommit.project_id == project_id)
            .order_by(ProgressCommit.committed_at.asc())
            .all()
        )

    def list_method_switches_for_project(self, project_id: str) -> list[MethodSwitch]:
        """Return the project's method switches, oldest first."""
        return (
            self._db.query(MethodSwitch)
            .filter(MethodSwitch.project_id == project_id)
            .order_by(MethodSwitch.switched_at.asc())
            .all()
        )

    def list_recent_sessions(self, project_ids: list[str], *, limit: int) -> list[LearningSession]:
        """Return the most recent sessions across the projects, newest first, capped at ``limit``."""
        if not project_ids:
            return []
        return (
            self._db.query(LearningSession)
            .filter(LearningSession.project_id.in_(project_ids))
            .order_by(LearningSession.started_at.desc())
            .limit(limit)
            .all()
        )

    def list_sessions_for_projects(self, project_ids: list[str]) -> list[LearningSession]:
        """Return every session belonging to the given projects (empty list if none)."""
        if not project_ids:
            return []
        return (
            self._db.query(LearningSession)
            .filter(LearningSession.project_id.in_(project_ids))
            .all()
        )

    def list_ratings_for_sessions(self, session_ids: list[str]) -> list[SessionRating]:
        """Return all ratings for the given sessions, newest first (empty list if none)."""
        if not session_ids:
            return []
        return (
            self._db.query(SessionRating)
            .filter(SessionRating.session_id.in_(session_ids))
            .order_by(SessionRating.created_at.desc())
            .all()
        )

    def list_step_evaluations_for_sessions(self, session_ids: list[str]) -> list[StepEvaluation]:
        """Return all step evaluations for the given sessions (empty list if none)."""
        if not session_ids:
            return []
        return (
            self._db.query(StepEvaluation).filter(StepEvaluation.session_id.in_(session_ids)).all()
        )

    def list_analyzed_conversations(self, user_id: str) -> list[ImportedConversation]:
        """Return the user's analyzed imported conversations, newest import first."""
        return (
            self._db.query(ImportedConversation)
            .filter(ImportedConversation.user_id == user_id)
            .filter(ImportedConversation.analyzed.is_(True))
            .order_by(ImportedConversation.imported_at.desc())
            .all()
        )

    # --- session detail ----------------------------------------------------
    def get_session(self, session_id: str) -> LearningSession | None:
        """Return the session row, or ``None`` when it does not exist."""
        return self._db.query(LearningSession).filter(LearningSession.id == session_id).first()

    def get_project(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""
        return self._db.query(LearningProject).filter(LearningProject.id == project_id).first()

    def list_messages_for_session(self, session_id: str) -> list[SessionMessage]:
        """Return the session's messages, oldest first."""
        return (
            self._db.query(SessionMessage)
            .filter(SessionMessage.session_id == session_id)
            .order_by(SessionMessage.created_at.asc())
            .all()
        )

    def latest_rating_for_session(self, session_id: str) -> SessionRating | None:
        """Return the session's most recent rating, or ``None``."""
        return (
            self._db.query(SessionRating)
            .filter(SessionRating.session_id == session_id)
            .order_by(SessionRating.created_at.desc())
            .first()
        )

    def list_step_evaluations_for_session(self, session_id: str) -> list[StepEvaluation]:
        """Return the session's step evaluations, oldest first."""
        return (
            self._db.query(StepEvaluation)
            .filter(StepEvaluation.session_id == session_id)
            .order_by(StepEvaluation.evaluated_at.asc())
            .all()
        )

    # --- curriculum overview ----------------------------------------------
    def get_curriculum(self, curriculum_id: str) -> Curriculum | None:
        """Return the curriculum row, or ``None`` when it does not exist."""
        return self._db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()

    def list_topics_for_curriculum(self, curriculum_id: str) -> list[LearningTopic]:
        """Return the curriculum's topics, ordered by index then creation."""
        return (
            self._db.query(LearningTopic)
            .filter(LearningTopic.curriculum_id == curriculum_id)
            .order_by(LearningTopic.order_index.asc(), LearningTopic.created_at.asc())
            .all()
        )

    def list_lessons_for_curriculum(self, curriculum_id: str) -> list[Lesson]:
        """Return the curriculum's lessons, ordered by index then creation."""
        return (
            self._db.query(Lesson)
            .filter(Lesson.curriculum_id == curriculum_id)
            .order_by(Lesson.order_index.asc(), Lesson.created_at.asc())
            .all()
        )


__all__ = ["ExportRepository", "SqlAlchemyExportRepository"]
