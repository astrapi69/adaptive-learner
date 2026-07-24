"""Curriculum + LearningTopic CRUD service (Phase 5-E; EXP-024 migration).

Business layer over :class:`CurriculumRepository`: validates,
enforces tree-integrity rules (cross-curriculum parenting, cycle
detection), and raises :class:`AdaptiveLearnerError` subclasses (never
``HTTPException`` — that's the global handler's job in :mod:`app.main`).
The service never touches SQLAlchemy directly.

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

from app.exceptions import NotFoundError, ValidationError
from app.models import Curriculum, LearningTopic, Lesson
from app.repositories.curriculum_repo import CurriculumRepository
from app.schemas import (
    CurriculumCreate,
    CurriculumUpdate,
    LearningTopicCreate,
    LearningTopicUpdate,
    LessonCreate,
    LessonUpdate,
)

# --- Curriculum CRUD -------------------------------------------------------


def create_curriculum(repo: CurriculumRepository, payload: CurriculumCreate) -> Curriculum:
    """Insert a new curriculum. Raises NotFoundError if the user
    doesn't exist (catches a bad client-supplied ``user_id``
    before the FK violation reaches SQLAlchemy)."""
    if repo.get_user(payload.user_id) is None:
        raise NotFoundError(f"User {payload.user_id!r} not found.")
    return repo.create_curriculum(
        user_id=payload.user_id,
        title=payload.title,
        description=payload.description,
        language=payload.language,
        imported_conversation_id=payload.imported_conversation_id,
    )


def get_curriculum_for_conversation(
    repo: CurriculumRepository, conversation_id: str
) -> Curriculum | None:
    """Phase 36 Bug 3 - return the curriculum created from this
    conversation (if any). Used by ImportDetail to flip the
    "Create curriculum" CTA into a "Go to curriculum" navigation.

    Returns ``None`` if the conversation never produced a
    curriculum, or if the curriculum was later deleted (the FK is
    ``SET NULL`` on conversation delete; this lookup catches only
    live curricula).
    """
    return repo.get_curriculum_by_conversation(conversation_id)


def get_curriculum(repo: CurriculumRepository, curriculum_id: str) -> Curriculum:
    row = repo.get_curriculum_by_id(curriculum_id)
    if row is None:
        raise NotFoundError(f"Curriculum {curriculum_id!r} not found.")
    return row


def list_curriculums_for_user(repo: CurriculumRepository, user_id: str) -> list[Curriculum]:
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return repo.list_curriculums_by_user(user_id)


def update_curriculum(
    repo: CurriculumRepository, curriculum_id: str, payload: CurriculumUpdate
) -> Curriculum:
    row = get_curriculum(repo, curriculum_id)
    updates = payload.model_dump(exclude_unset=True)
    return repo.apply_curriculum_update(row, updates)


def delete_curriculum(repo: CurriculumRepository, curriculum_id: str) -> None:
    row = get_curriculum(repo, curriculum_id)
    repo.delete_curriculum(row)


# --- LearningTopic CRUD ----------------------------------------------------


def list_topics(repo: CurriculumRepository, curriculum_id: str) -> list[LearningTopic]:
    """Return every topic for the curriculum, ordered by
    ``order_index`` ASC then created_at ASC. Frontend rebuilds
    the tree via ``buildTreeFromFlat`` (no nested-JSON wire
    representation — keeps the round-trip cheap).
    """
    get_curriculum(repo, curriculum_id)
    return repo.list_topics(curriculum_id)


def get_topic(repo: CurriculumRepository, topic_id: str) -> LearningTopic:
    row = repo.get_topic_by_id(topic_id)
    if row is None:
        raise NotFoundError(f"LearningTopic {topic_id!r} not found.")
    return row


def create_topic(repo: CurriculumRepository, payload: LearningTopicCreate) -> LearningTopic:
    """Insert a topic under the curriculum. ``parent_id`` must
    resolve to a topic IN THE SAME curriculum (cross-curriculum
    parenting is a data-integrity bug)."""
    get_curriculum(repo, payload.curriculum_id)
    if payload.parent_id is not None:
        parent = get_topic(repo, payload.parent_id)
        if parent.curriculum_id != payload.curriculum_id:
            raise ValidationError(
                f"Parent topic {payload.parent_id!r} is in a different curriculum."
            )
    return repo.create_topic(
        curriculum_id=payload.curriculum_id,
        parent_id=payload.parent_id,
        title=payload.title,
        description=payload.description,
        order_index=payload.order_index,
    )


def _would_create_cycle(repo: CurriculumRepository, topic_id: str, new_parent_id: str) -> bool:
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
        row = repo.get_topic_by_id(cursor)
        if row is None:
            return False
        cursor = row.parent_id
    return False


def update_topic(
    repo: CurriculumRepository, topic_id: str, payload: LearningTopicUpdate
) -> LearningTopic:
    """Patch the topic. ``parent_id`` swaps need a cycle check -
    setting a topic's parent to one of its own descendants would
    create an infinite loop in the tree walk.
    """
    row = get_topic(repo, topic_id)
    updates = payload.model_dump(exclude_unset=True)

    if "parent_id" in updates:
        new_parent = updates["parent_id"]
        if new_parent is not None:
            parent_row = repo.get_topic_by_id(new_parent)
            if parent_row is None:
                raise NotFoundError(f"LearningTopic {new_parent!r} not found.")
            if parent_row.curriculum_id != row.curriculum_id:
                raise ValidationError("Parent topic is in a different curriculum.")
            if new_parent == topic_id:
                raise ValidationError("A topic cannot be its own parent.")
            if _would_create_cycle(repo, topic_id, new_parent):
                raise ValidationError("Move would create a cycle in the topic tree.")

    return repo.apply_topic_update(row, updates)


def delete_topic(repo: CurriculumRepository, topic_id: str) -> None:
    """Delete a topic. Per the model's ``ondelete='SET NULL'``
    contract, every child topic's ``parent_id`` becomes NULL —
    they keep existing as roots of their own subtrees rather than
    cascading away with the parent.
    """
    row = get_topic(repo, topic_id)
    repo.delete_topic(row)


# --- Lesson CRUD ----------------------------------------------------------


def list_lessons(repo: CurriculumRepository, curriculum_id: str) -> list[Lesson]:
    """Return every lesson for the curriculum, ordered by
    ``order_index`` ASC then created_at ASC. Lessons are a flat
    list inside the curriculum (per the model design — they are
    not attached to specific topics in v0.3.0).
    """
    get_curriculum(repo, curriculum_id)
    return repo.list_lessons(curriculum_id)


def get_lesson(repo: CurriculumRepository, lesson_id: str) -> Lesson:
    row = repo.get_lesson_by_id(lesson_id)
    if row is None:
        raise NotFoundError(f"Lesson {lesson_id!r} not found.")
    return row


def create_lesson(repo: CurriculumRepository, payload: LessonCreate) -> Lesson:
    """Insert a lesson under the curriculum. Raises NotFoundError
    if the curriculum doesn't exist (catches a bad client-supplied
    ``curriculum_id`` before the FK violation reaches SQLAlchemy).
    """
    get_curriculum(repo, payload.curriculum_id)
    return repo.create_lesson(
        curriculum_id=payload.curriculum_id,
        title=payload.title,
        content=payload.content,
        order_index=payload.order_index,
    )


def update_lesson(repo: CurriculumRepository, lesson_id: str, payload: LessonUpdate) -> Lesson:
    row = get_lesson(repo, lesson_id)
    updates = payload.model_dump(exclude_unset=True)
    return repo.apply_lesson_update(row, updates)


def delete_lesson(repo: CurriculumRepository, lesson_id: str) -> None:
    row = get_lesson(repo, lesson_id)
    repo.delete_lesson(row)


__all__ = [
    "create_curriculum",
    "create_lesson",
    "create_topic",
    "delete_curriculum",
    "delete_lesson",
    "delete_topic",
    "get_curriculum",
    "get_curriculum_for_conversation",
    "get_lesson",
    "get_topic",
    "list_curriculums_for_user",
    "list_lessons",
    "list_topics",
    "update_curriculum",
    "update_lesson",
    "update_topic",
]
