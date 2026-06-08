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
    def get_user(self, user_id: str) -> User | None: ...

    @abstractmethod
    def create_curriculum(
        self,
        *,
        user_id: str,
        title: str,
        description: str | None,
        language: str | None,
        imported_conversation_id: str | None,
    ) -> Curriculum: ...

    @abstractmethod
    def get_curriculum_by_id(self, curriculum_id: str) -> Curriculum | None: ...

    @abstractmethod
    def get_curriculum_by_conversation(self, conversation_id: str) -> Curriculum | None: ...

    @abstractmethod
    def list_curriculums_by_user(self, user_id: str) -> list[Curriculum]: ...

    @abstractmethod
    def apply_curriculum_update(
        self, row: Curriculum, fields: Mapping[str, object]
    ) -> Curriculum: ...

    @abstractmethod
    def delete_curriculum(self, row: Curriculum) -> None: ...

    # --- LearningTopic -----------------------------------------------------
    @abstractmethod
    def list_topics(self, curriculum_id: str) -> list[LearningTopic]: ...

    @abstractmethod
    def get_topic_by_id(self, topic_id: str) -> LearningTopic | None: ...

    @abstractmethod
    def create_topic(
        self,
        *,
        curriculum_id: str,
        parent_id: str | None,
        title: str,
        description: str | None,
        order_index: int,
    ) -> LearningTopic: ...

    @abstractmethod
    def apply_topic_update(
        self, row: LearningTopic, fields: Mapping[str, object]
    ) -> LearningTopic: ...

    @abstractmethod
    def delete_topic(self, row: LearningTopic) -> None: ...

    # --- Lesson ------------------------------------------------------------
    @abstractmethod
    def list_lessons(self, curriculum_id: str) -> list[Lesson]: ...

    @abstractmethod
    def get_lesson_by_id(self, lesson_id: str) -> Lesson | None: ...

    @abstractmethod
    def create_lesson(
        self, *, curriculum_id: str, title: str, content: object, order_index: int
    ) -> Lesson: ...

    @abstractmethod
    def apply_lesson_update(self, row: Lesson, fields: Mapping[str, object]) -> Lesson: ...

    @abstractmethod
    def delete_lesson(self, row: Lesson) -> None: ...


class SqlAlchemyCurriculumRepository(CurriculumRepository):
    """SQLAlchemy-backed :class:`CurriculumRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # --- Curriculum --------------------------------------------------------
    def get_user(self, user_id: str) -> User | None:
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
        return self._db.get(Curriculum, curriculum_id)

    def get_curriculum_by_conversation(self, conversation_id: str) -> Curriculum | None:
        return (
            self._db.query(Curriculum)
            .filter(Curriculum.imported_conversation_id == conversation_id)
            .first()
        )

    def list_curriculums_by_user(self, user_id: str) -> list[Curriculum]:
        return (
            self._db.query(Curriculum)
            .filter(Curriculum.user_id == user_id)
            .order_by(Curriculum.created_at.asc())
            .all()
        )

    def apply_curriculum_update(self, row: Curriculum, fields: Mapping[str, object]) -> Curriculum:
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_curriculum(self, row: Curriculum) -> None:
        self._db.delete(row)
        self._db.commit()

    # --- LearningTopic -----------------------------------------------------
    def list_topics(self, curriculum_id: str) -> list[LearningTopic]:
        return (
            self._db.query(LearningTopic)
            .filter(LearningTopic.curriculum_id == curriculum_id)
            .order_by(LearningTopic.order_index.asc(), LearningTopic.created_at.asc())
            .all()
        )

    def get_topic_by_id(self, topic_id: str) -> LearningTopic | None:
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
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_topic(self, row: LearningTopic) -> None:
        self._db.delete(row)
        self._db.commit()

    # --- Lesson ------------------------------------------------------------
    def list_lessons(self, curriculum_id: str) -> list[Lesson]:
        return (
            self._db.query(Lesson)
            .filter(Lesson.curriculum_id == curriculum_id)
            .order_by(Lesson.order_index.asc(), Lesson.created_at.asc())
            .all()
        )

    def get_lesson_by_id(self, lesson_id: str) -> Lesson | None:
        return self._db.get(Lesson, lesson_id)

    def create_lesson(
        self, *, curriculum_id: str, title: str, content: object, order_index: int
    ) -> Lesson:
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
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_lesson(self, row: Lesson) -> None:
        self._db.delete(row)
        self._db.commit()


__all__ = ["CurriculumRepository", "SqlAlchemyCurriculumRepository"]
