"""Repository for the Curriculum / LearningTopic / Lesson aggregates
(Phase 5-E; EXP-024 Phase 1).

Encapsulates persistence for the curriculum tree. Tree-integrity rules
(cross-curriculum parenting, cycle detection) and domain errors stay in
``app.services.curriculum``; this layer only reads and writes rows.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.models import Curriculum, LearningTopic, Lesson, User
from app.repositories.base import Repository


class CurriculumRepository(Repository):
    """Persistence contract for curricula, topics, and lessons."""

    # --- Curriculum --------------------------------------------------------
    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def create_curriculum(
        self,
        *,
        user_id: str,
        title: str,
        description: str | None,
        language: str | None,
        imported_conversation_id: str | None,
    ) -> Curriculum:
        """Persist a new curriculum and return the committed row."""

    @abstractmethod
    def get_curriculum_by_id(self, curriculum_id: str) -> Curriculum | None:
        """Return the curriculum with the given id, or ``None`` if absent."""

    @abstractmethod
    def get_curriculum_by_conversation(self, conversation_id: str) -> Curriculum | None:
        """Return the curriculum linked to the imported conversation, or ``None``."""

    @abstractmethod
    def list_curriculums_by_user(self, user_id: str) -> list[Curriculum]:
        """Return the user's curricula, oldest-created first."""

    @abstractmethod
    def apply_curriculum_update(self, row: Curriculum, fields: Mapping[str, object]) -> Curriculum:
        """Apply the given field updates to ``row``, commit, and return it."""

    @abstractmethod
    def delete_curriculum(self, row: Curriculum) -> None:
        """Delete the curriculum row and commit."""

    # --- LearningTopic -----------------------------------------------------
    @abstractmethod
    def list_topics(self, curriculum_id: str) -> list[LearningTopic]:
        """Return the curriculum's topics ordered by order index, then creation."""

    @abstractmethod
    def get_topic_by_id(self, topic_id: str) -> LearningTopic | None:
        """Return the topic with the given id, or ``None`` if absent."""

    @abstractmethod
    def create_topic(
        self,
        *,
        curriculum_id: str,
        parent_id: str | None,
        title: str,
        description: str | None,
        order_index: int,
    ) -> LearningTopic:
        """Persist a new topic and return the committed row."""

    @abstractmethod
    def apply_topic_update(self, row: LearningTopic, fields: Mapping[str, object]) -> LearningTopic:
        """Apply the given field updates to ``row``, commit, and return it."""

    @abstractmethod
    def delete_topic(self, row: LearningTopic) -> None:
        """Delete the topic row and commit."""

    # --- Lesson ------------------------------------------------------------
    @abstractmethod
    def list_lessons(self, curriculum_id: str) -> list[Lesson]:
        """Return the curriculum's lessons ordered by order index, then creation."""

    @abstractmethod
    def get_lesson_by_id(self, lesson_id: str) -> Lesson | None:
        """Return the lesson with the given id, or ``None`` if absent."""

    @abstractmethod
    def create_lesson(
        self, *, curriculum_id: str, title: str, content: object, order_index: int
    ) -> Lesson:
        """Persist a new lesson and return the committed row."""

    @abstractmethod
    def apply_lesson_update(self, row: Lesson, fields: Mapping[str, object]) -> Lesson:
        """Apply the given field updates to ``row``, commit, and return it."""

    @abstractmethod
    def delete_lesson(self, row: Lesson) -> None:
        """Delete the lesson row and commit."""


class SqlAlchemyCurriculumRepository(CurriculumRepository):
    """SQLAlchemy-backed :class:`CurriculumRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # --- Curriculum --------------------------------------------------------
    def get_user(self, user_id: str) -> User | None:
        """Return the user row by primary key, or ``None`` if absent."""
        return self._db.get(User, user_id)

    def create_curriculum(
        self,
        *,
        user_id: str,
        title: str,
        description: str | None,
        language: str | None,
        imported_conversation_id: str | None,
    ) -> Curriculum:
        """Insert a curriculum, commit, and return the refreshed row."""
        row = Curriculum(
            user_id=user_id,
            title=title,
            description=description,
            language=language,
            imported_conversation_id=imported_conversation_id,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_curriculum_by_id(self, curriculum_id: str) -> Curriculum | None:
        """Return the curriculum by primary key, or ``None`` if absent."""
        return self._db.get(Curriculum, curriculum_id)

    def get_curriculum_by_conversation(self, conversation_id: str) -> Curriculum | None:
        """Return the first curriculum linked to the conversation id, or ``None``."""
        return (
            self._db.query(Curriculum)
            .filter(Curriculum.imported_conversation_id == conversation_id)
            .first()
        )

    def list_curriculums_by_user(self, user_id: str) -> list[Curriculum]:
        """Return the user's curricula ordered by creation time, ascending."""
        return (
            self._db.query(Curriculum)
            .filter(Curriculum.user_id == user_id)
            .order_by(Curriculum.created_at.asc())
            .all()
        )

    def apply_curriculum_update(self, row: Curriculum, fields: Mapping[str, object]) -> Curriculum:
        """Set the given fields on ``row``, commit, and return the refreshed row."""
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_curriculum(self, row: Curriculum) -> None:
        """Delete the curriculum row and commit."""
        self._db.delete(row)
        self._db.commit()

    # --- LearningTopic -----------------------------------------------------
    def list_topics(self, curriculum_id: str) -> list[LearningTopic]:
        """Return the curriculum's topics ordered by order index, then creation."""
        return (
            self._db.query(LearningTopic)
            .filter(LearningTopic.curriculum_id == curriculum_id)
            .order_by(LearningTopic.order_index.asc(), LearningTopic.created_at.asc())
            .all()
        )

    def get_topic_by_id(self, topic_id: str) -> LearningTopic | None:
        """Return the topic by primary key, or ``None`` if absent."""
        return self._db.get(LearningTopic, topic_id)

    def create_topic(
        self,
        *,
        curriculum_id: str,
        parent_id: str | None,
        title: str,
        description: str | None,
        order_index: int,
    ) -> LearningTopic:
        """Insert a topic, commit, and return the refreshed row."""
        row = LearningTopic(
            curriculum_id=curriculum_id,
            parent_id=parent_id,
            title=title,
            description=description,
            order_index=order_index,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def apply_topic_update(self, row: LearningTopic, fields: Mapping[str, object]) -> LearningTopic:
        """Set the given fields on ``row``, commit, and return the refreshed row."""
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_topic(self, row: LearningTopic) -> None:
        """Delete the topic row and commit."""
        self._db.delete(row)
        self._db.commit()

    # --- Lesson ------------------------------------------------------------
    def list_lessons(self, curriculum_id: str) -> list[Lesson]:
        """Return the curriculum's lessons ordered by order index, then creation."""
        return (
            self._db.query(Lesson)
            .filter(Lesson.curriculum_id == curriculum_id)
            .order_by(Lesson.order_index.asc(), Lesson.created_at.asc())
            .all()
        )

    def get_lesson_by_id(self, lesson_id: str) -> Lesson | None:
        """Return the lesson by primary key, or ``None`` if absent."""
        return self._db.get(Lesson, lesson_id)

    def create_lesson(
        self, *, curriculum_id: str, title: str, content: object, order_index: int
    ) -> Lesson:
        """Insert a lesson, commit, and return the refreshed row."""
        row = Lesson(
            curriculum_id=curriculum_id,
            title=title,
            content=content,
            order_index=order_index,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def apply_lesson_update(self, row: Lesson, fields: Mapping[str, object]) -> Lesson:
        """Set the given fields on ``row``, commit, and return the refreshed row."""
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_lesson(self, row: Lesson) -> None:
        """Delete the lesson row and commit."""
        self._db.delete(row)
        self._db.commit()


__all__ = ["CurriculumRepository", "SqlAlchemyCurriculumRepository"]
