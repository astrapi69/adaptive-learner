"""Curriculum + LearningTopic CRUD service (Phase 5-E).

DB-facing functions: take a SQLAlchemy ``Session`` plus a typed
payload, return the ORM row. Raise :class:`AdaptiveLearnerError`
subclasses (never ``HTTPException`` — that's the global handler's
job in :mod:`app.main`).

LearningTopic-tree semantics:

- Curriculum deletion cascades to every topic (cascade="all,
  delete-orphan" on the relationship in the model).
- LearningTopic deletion uses ``ondelete="SET NULL"`` on the
  self-FK ``parent_id``; deleting a parent detaches the
  children rather than cascading the delete. The service's
  ``delete_topic`` matches that contract: children become roots
  of their own subtrees.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models import Curriculum, LearningTopic, Lesson, User
from app.schemas import (
    CurriculumCreate,
    CurriculumUpdate,
    LearningTopicCreate,
    LearningTopicUpdate,
    LessonCreate,
    LessonUpdate,
)

# --- Curriculum CRUD -------------------------------------------------------


def create_curriculum(db: Session, payload: CurriculumCreate) -> Curriculum:
    """Insert a new curriculum. Raises NotFoundError if the user
    doesn't exist (catches a bad client-supplied ``user_id``
    before the FK violation reaches SQLAlchemy)."""
    if db.get(User, payload.user_id) is None:
        raise NotFoundError(f"User {payload.user_id!r} not found.")
    row = Curriculum(
        user_id=payload.user_id,
        title=payload.title,
        description=payload.description,
        language=payload.language,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_curriculum(db: Session, curriculum_id: str) -> Curriculum:
    row = db.get(Curriculum, curriculum_id)
    if row is None:
        raise NotFoundError(f"Curriculum {curriculum_id!r} not found.")
    return row


def list_curriculums_for_user(db: Session, user_id: str) -> list[Curriculum]:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return (
        db.query(Curriculum)
        .filter(Curriculum.user_id == user_id)
        .order_by(Curriculum.created_at.asc())
        .all()
    )


def update_curriculum(db: Session, curriculum_id: str, payload: CurriculumUpdate) -> Curriculum:
    row = get_curriculum(db, curriculum_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_curriculum(db: Session, curriculum_id: str) -> None:
    row = get_curriculum(db, curriculum_id)
    db.delete(row)
    db.commit()


# --- LearningTopic CRUD ----------------------------------------------------


def list_topics(db: Session, curriculum_id: str) -> list[LearningTopic]:
    """Return every topic for the curriculum, ordered by
    ``order_index`` ASC then created_at ASC. Frontend rebuilds
    the tree via ``buildTreeFromFlat`` (no nested-JSON wire
    representation — keeps the round-trip cheap).
    """
    get_curriculum(db, curriculum_id)
    return (
        db.query(LearningTopic)
        .filter(LearningTopic.curriculum_id == curriculum_id)
        .order_by(LearningTopic.order_index.asc(), LearningTopic.created_at.asc())
        .all()
    )


def get_topic(db: Session, topic_id: str) -> LearningTopic:
    row = db.get(LearningTopic, topic_id)
    if row is None:
        raise NotFoundError(f"LearningTopic {topic_id!r} not found.")
    return row


def create_topic(db: Session, payload: LearningTopicCreate) -> LearningTopic:
    """Insert a topic under the curriculum. ``parent_id`` must
    resolve to a topic IN THE SAME curriculum (cross-curriculum
    parenting is a data-integrity bug)."""
    get_curriculum(db, payload.curriculum_id)
    if payload.parent_id is not None:
        parent = get_topic(db, payload.parent_id)
        if parent.curriculum_id != payload.curriculum_id:
            raise ValidationError(
                f"Parent topic {payload.parent_id!r} is in a different curriculum."
            )
    row = LearningTopic(
        curriculum_id=payload.curriculum_id,
        parent_id=payload.parent_id,
        title=payload.title,
        description=payload.description,
        order_index=payload.order_index,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _would_create_cycle(db: Session, topic_id: str, new_parent_id: str) -> bool:
    """Walk up from ``new_parent_id`` toward the root; if we hit
    ``topic_id`` along the way, the proposed move would create a
    cycle."""
    cursor: str | None = new_parent_id
    visited: set[str] = set()
    while cursor is not None:
        if cursor == topic_id:
            return True
        if cursor in visited:
            # Defensive: a pre-existing cycle in the DB would loop
            # forever. Bail out rather than hang.
            return True
        visited.add(cursor)
        row = db.get(LearningTopic, cursor)
        if row is None:
            return False
        cursor = row.parent_id
    return False


def update_topic(db: Session, topic_id: str, payload: LearningTopicUpdate) -> LearningTopic:
    """Patch the topic. ``parent_id`` swaps need a cycle check —
    setting a topic's parent to one of its own descendants would
    create an infinite loop in the tree walk.
    """
    row = get_topic(db, topic_id)
    updates = payload.model_dump(exclude_unset=True)

    if "parent_id" in updates:
        new_parent = updates["parent_id"]
        if new_parent is not None:
            parent_row = db.get(LearningTopic, new_parent)
            if parent_row is None:
                raise NotFoundError(f"LearningTopic {new_parent!r} not found.")
            if parent_row.curriculum_id != row.curriculum_id:
                raise ValidationError("Parent topic is in a different curriculum.")
            if new_parent == topic_id:
                raise ValidationError("A topic cannot be its own parent.")
            if _would_create_cycle(db, topic_id, new_parent):
                raise ValidationError("Move would create a cycle in the topic tree.")

    for field, value in updates.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_topic(db: Session, topic_id: str) -> None:
    """Delete a topic. Per the model's ``ondelete='SET NULL'``
    contract, every child topic's ``parent_id`` becomes NULL —
    they keep existing as roots of their own subtrees rather than
    cascading away with the parent.
    """
    row = get_topic(db, topic_id)
    db.delete(row)
    db.commit()


# --- Lesson CRUD ----------------------------------------------------------


def list_lessons(db: Session, curriculum_id: str) -> list[Lesson]:
    """Return every lesson for the curriculum, ordered by
    ``order_index`` ASC then created_at ASC. Lessons are a flat
    list inside the curriculum (per the model design — they are
    not attached to specific topics in v0.3.0).
    """
    get_curriculum(db, curriculum_id)
    return (
        db.query(Lesson)
        .filter(Lesson.curriculum_id == curriculum_id)
        .order_by(Lesson.order_index.asc(), Lesson.created_at.asc())
        .all()
    )


def get_lesson(db: Session, lesson_id: str) -> Lesson:
    row = db.get(Lesson, lesson_id)
    if row is None:
        raise NotFoundError(f"Lesson {lesson_id!r} not found.")
    return row


def create_lesson(db: Session, payload: LessonCreate) -> Lesson:
    """Insert a lesson under the curriculum. Raises NotFoundError
    if the curriculum doesn't exist (catches a bad client-supplied
    ``curriculum_id`` before the FK violation reaches SQLAlchemy).
    """
    get_curriculum(db, payload.curriculum_id)
    row = Lesson(
        curriculum_id=payload.curriculum_id,
        title=payload.title,
        content=payload.content,
        order_index=payload.order_index,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_lesson(db: Session, lesson_id: str, payload: LessonUpdate) -> Lesson:
    row = get_lesson(db, lesson_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_lesson(db: Session, lesson_id: str) -> None:
    row = get_lesson(db, lesson_id)
    db.delete(row)
    db.commit()


__all__ = [
    "create_curriculum",
    "create_lesson",
    "create_topic",
    "delete_curriculum",
    "delete_lesson",
    "delete_topic",
    "get_curriculum",
    "get_lesson",
    "get_topic",
    "list_curriculums_for_user",
    "list_lessons",
    "list_topics",
    "update_curriculum",
    "update_lesson",
    "update_topic",
]
