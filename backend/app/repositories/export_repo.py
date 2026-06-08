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
    def get_user(self, user_id: str) -> User | None: ...

    @abstractmethod
    def list_projects_by_user(self, user_id: str) -> list[LearningProject]: ...

    @abstractmethod
    def list_projects_by_ids(self, project_ids: list[str]) -> list[LearningProject]: ...

    @abstractmethod
    def latest_profile(self, user_id: str) -> LearningProfile | None: ...

    @abstractmethod
    def list_commits_for_project(self, project_id: str) -> list[ProgressCommit]: ...

    @abstractmethod
    def list_method_switches_for_project(self, project_id: str) -> list[MethodSwitch]: ...

    @abstractmethod
    def list_recent_sessions(
        self, project_ids: list[str], *, limit: int
    ) -> list[LearningSession]: ...

    @abstractmethod
    def list_sessions_for_projects(self, project_ids: list[str]) -> list[LearningSession]: ...

    @abstractmethod
    def list_ratings_for_sessions(self, session_ids: list[str]) -> list[SessionRating]: ...

    @abstractmethod
    def list_step_evaluations_for_sessions(
        self, session_ids: list[str]
    ) -> list[StepEvaluation]: ...

    @abstractmethod
    def list_analyzed_conversations(self, user_id: str) -> list[ImportedConversation]: ...

    # --- session detail ----------------------------------------------------
    @abstractmethod
    def get_session(self, session_id: str) -> LearningSession | None: ...

    @abstractmethod
    def get_project(self, project_id: str) -> LearningProject | None: ...

    @abstractmethod
    def list_messages_for_session(self, session_id: str) -> list[SessionMessage]: ...

    @abstractmethod
    def latest_rating_for_session(self, session_id: str) -> SessionRating | None: ...

    @abstractmethod
    def list_step_evaluations_for_session(self, session_id: str) -> list[StepEvaluation]: ...

    # --- curriculum overview ----------------------------------------------
    @abstractmethod
    def get_curriculum(self, curriculum_id: str) -> Curriculum | None: ...

    @abstractmethod
    def list_topics_for_curriculum(self, curriculum_id: str) -> list[LearningTopic]: ...

    @abstractmethod
    def list_lessons_for_curriculum(self, curriculum_id: str) -> list[Lesson]: ...


class SqlAlchemyExportRepository(ExportRepository):
    """SQLAlchemy-backed :class:`ExportRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # --- progress report ---------------------------------------------------
    def get_user(self, user_id: str) -> User | None:
        return self._db.query(User).filter(User.id == user_id).first()

    def list_projects_by_user(self, user_id: str) -> list[LearningProject]:
        return (
            self._db.query(LearningProject)
            .filter(LearningProject.user_id == user_id)
            .order_by(LearningProject.created_at.asc())
            .all()
        )

    def list_projects_by_ids(self, project_ids: list[str]) -> list[LearningProject]:
        if not project_ids:
            return []
        return self._db.query(LearningProject).filter(LearningProject.id.in_(project_ids)).all()

    def latest_profile(self, user_id: str) -> LearningProfile | None:
        return (
            self._db.query(LearningProfile)
            .filter(LearningProfile.user_id == user_id)
            .order_by(LearningProfile.assessed_at.desc())
            .first()
        )

    def list_commits_for_project(self, project_id: str) -> list[ProgressCommit]:
        return (
            self._db.query(ProgressCommit)
            .filter(ProgressCommit.project_id == project_id)
            .order_by(ProgressCommit.committed_at.asc())
            .all()
        )

    def list_method_switches_for_project(self, project_id: str) -> list[MethodSwitch]:
        return (
            self._db.query(MethodSwitch)
            .filter(MethodSwitch.project_id == project_id)
            .order_by(MethodSwitch.switched_at.asc())
            .all()
        )

    def list_recent_sessions(self, project_ids: list[str], *, limit: int) -> list[LearningSession]:
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
        if not project_ids:
            return []
        return (
            self._db.query(LearningSession)
            .filter(LearningSession.project_id.in_(project_ids))
            .all()
        )

    def list_ratings_for_sessions(self, session_ids: list[str]) -> list[SessionRating]:
        if not session_ids:
            return []
        return (
            self._db.query(SessionRating)
            .filter(SessionRating.session_id.in_(session_ids))
            .order_by(SessionRating.created_at.desc())
            .all()
        )

    def list_step_evaluations_for_sessions(self, session_ids: list[str]) -> list[StepEvaluation]:
        if not session_ids:
            return []
        return (
            self._db.query(StepEvaluation).filter(StepEvaluation.session_id.in_(session_ids)).all()
        )

    def list_analyzed_conversations(self, user_id: str) -> list[ImportedConversation]:
        return (
            self._db.query(ImportedConversation)
            .filter(ImportedConversation.user_id == user_id)
            .filter(ImportedConversation.analyzed.is_(True))
            .order_by(ImportedConversation.imported_at.desc())
            .all()
        )

    # --- session detail ----------------------------------------------------
    def get_session(self, session_id: str) -> LearningSession | None:
        return self._db.query(LearningSession).filter(LearningSession.id == session_id).first()

    def get_project(self, project_id: str) -> LearningProject | None:
        return self._db.query(LearningProject).filter(LearningProject.id == project_id).first()

    def list_messages_for_session(self, session_id: str) -> list[SessionMessage]:
        return (
            self._db.query(SessionMessage)
            .filter(SessionMessage.session_id == session_id)
            .order_by(SessionMessage.created_at.asc())
            .all()
        )

    def latest_rating_for_session(self, session_id: str) -> SessionRating | None:
        return (
            self._db.query(SessionRating)
            .filter(SessionRating.session_id == session_id)
            .order_by(SessionRating.created_at.desc())
            .first()
        )

    def list_step_evaluations_for_session(self, session_id: str) -> list[StepEvaluation]:
        return (
            self._db.query(StepEvaluation)
            .filter(StepEvaluation.session_id == session_id)
            .order_by(StepEvaluation.evaluated_at.asc())
            .all()
        )

    # --- curriculum overview ----------------------------------------------
    def get_curriculum(self, curriculum_id: str) -> Curriculum | None:
        return self._db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()

    def list_topics_for_curriculum(self, curriculum_id: str) -> list[LearningTopic]:
        return (
            self._db.query(LearningTopic)
            .filter(LearningTopic.curriculum_id == curriculum_id)
            .order_by(LearningTopic.order_index.asc(), LearningTopic.created_at.asc())
            .all()
        )

    def list_lessons_for_curriculum(self, curriculum_id: str) -> list[Lesson]:
        return (
            self._db.query(Lesson)
            .filter(Lesson.curriculum_id == curriculum_id)
            .order_by(Lesson.order_index.asc(), Lesson.created_at.asc())
            .all()
        )


__all__ = ["ExportRepository", "SqlAlchemyExportRepository"]
