"""Subject + Tag + project-association CRUD (Phase 22C).

Subjects are GLOBAL — no per-user scoping. Tags are per-user
(unique on ``(user_id, name)``). Both association tables
(``project_subjects``, ``project_tags``) are M:N with a unique
pair constraint; duplicate assignments are no-ops, not errors.

Services raise :class:`AdaptiveLearnerError` subclasses; the
global exception handler in :mod:`app.main` maps them to HTTP
codes. Routers stay thin.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    LearningProject,
    ProjectSubject,
    ProjectTag,
    Subject,
    Tag,
    User,
)
from app.schemas import (
    SubjectCreate,
    SubjectUpdate,
    TagCreate,
    TagUpdate,
)

# --- Subject CRUD ----------------------------------------------------------


def create_subject(db: Session, payload: SubjectCreate) -> Subject:
    if payload.parent_id is not None and db.get(Subject, payload.parent_id) is None:
        raise NotFoundError(f"Parent subject {payload.parent_id!r} not found.")
    row = Subject(
        parent_id=payload.parent_id,
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_subject(db: Session, subject_id: str) -> Subject:
    row = db.get(Subject, subject_id)
    if row is None:
        raise NotFoundError(f"Subject {subject_id!r} not found.")
    return row


def list_subjects(db: Session) -> list[Subject]:
    """Return every subject. The frontend rebuilds the tree from
    the flat list via the TypedTreeNode adapter (same shape as
    ``LearningTopic``)."""
    return db.query(Subject).order_by(Subject.name.asc()).all()


def update_subject(db: Session, subject_id: str, payload: SubjectUpdate) -> Subject:
    row = get_subject(db, subject_id)
    updates = payload.model_dump(exclude_unset=True)
    if "parent_id" in updates and updates["parent_id"] is not None:
        if updates["parent_id"] == subject_id:
            raise ValidationError("Subject cannot be its own parent.")
        if db.get(Subject, updates["parent_id"]) is None:
            raise NotFoundError(f"Parent subject {updates['parent_id']!r} not found.")
    for field, value in updates.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_subject(db: Session, subject_id: str) -> None:
    """Delete one subject. Children detach (``ondelete=SET NULL``);
    the subject's project-associations cascade via the M:N table's
    FK to ``subjects.id``."""
    row = get_subject(db, subject_id)
    db.delete(row)
    db.commit()


# --- Tag CRUD --------------------------------------------------------------


def create_tag(db: Session, user_id: str, payload: TagCreate) -> Tag:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    # The DB has a uniqueness constraint on (user_id, name), but
    # surface a clean ConflictError instead of an IntegrityError.
    existing = db.query(Tag).filter(Tag.user_id == user_id, Tag.name == payload.name).first()
    if existing is not None:
        raise ConflictError(f"Tag {payload.name!r} already exists for this user.")
    row = Tag(user_id=user_id, name=payload.name, color=payload.color)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_tag(db: Session, tag_id: str) -> Tag:
    row = db.get(Tag, tag_id)
    if row is None:
        raise NotFoundError(f"Tag {tag_id!r} not found.")
    return row


def list_tags_for_user(db: Session, user_id: str) -> list[Tag]:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return db.query(Tag).filter(Tag.user_id == user_id).order_by(Tag.name.asc()).all()


def update_tag(db: Session, tag_id: str, payload: TagUpdate) -> Tag:
    row = get_tag(db, tag_id)
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != row.name:
        clash = (
            db.query(Tag)
            .filter(
                Tag.user_id == row.user_id,
                Tag.name == updates["name"],
                Tag.id != tag_id,
            )
            .first()
        )
        if clash is not None:
            raise ConflictError(f"Tag {updates['name']!r} already exists for this user.")
    for field, value in updates.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_tag(db: Session, tag_id: str) -> None:
    row = get_tag(db, tag_id)
    db.delete(row)
    db.commit()


# --- Project associations --------------------------------------------------


def _get_project(db: Session, project_id: str) -> LearningProject:
    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"Project {project_id!r} not found.")
    return project


def assign_subject_to_project(db: Session, project_id: str, subject_id: str) -> ProjectSubject:
    _get_project(db, project_id)
    if db.get(Subject, subject_id) is None:
        raise NotFoundError(f"Subject {subject_id!r} not found.")
    existing = (
        db.query(ProjectSubject)
        .filter(
            ProjectSubject.project_id == project_id,
            ProjectSubject.subject_id == subject_id,
        )
        .first()
    )
    if existing is not None:
        return existing  # idempotent
    row = ProjectSubject(project_id=project_id, subject_id=subject_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def unassign_subject_from_project(db: Session, project_id: str, subject_id: str) -> None:
    existing = (
        db.query(ProjectSubject)
        .filter(
            ProjectSubject.project_id == project_id,
            ProjectSubject.subject_id == subject_id,
        )
        .first()
    )
    if existing is None:
        raise NotFoundError(f"Subject {subject_id!r} is not assigned to project {project_id!r}.")
    db.delete(existing)
    db.commit()


def list_project_subjects(db: Session, project_id: str) -> list[Subject]:
    _get_project(db, project_id)
    return (
        db.query(Subject)
        .join(ProjectSubject, ProjectSubject.subject_id == Subject.id)
        .filter(ProjectSubject.project_id == project_id)
        .order_by(Subject.name.asc())
        .all()
    )


def assign_tag_to_project(db: Session, project_id: str, tag_id: str) -> ProjectTag:
    project = _get_project(db, project_id)
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError(f"Tag {tag_id!r} not found.")
    # Defensive: a tag belongs to a user; the project must belong
    # to the SAME user. Cross-user tagging is meaningless.
    if tag.user_id != project.user_id:
        raise ValidationError("Tag and project belong to different users.")
    existing = (
        db.query(ProjectTag)
        .filter(
            ProjectTag.project_id == project_id,
            ProjectTag.tag_id == tag_id,
        )
        .first()
    )
    if existing is not None:
        return existing
    row = ProjectTag(project_id=project_id, tag_id=tag_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def unassign_tag_from_project(db: Session, project_id: str, tag_id: str) -> None:
    existing = (
        db.query(ProjectTag)
        .filter(
            ProjectTag.project_id == project_id,
            ProjectTag.tag_id == tag_id,
        )
        .first()
    )
    if existing is None:
        raise NotFoundError(f"Tag {tag_id!r} is not assigned to project {project_id!r}.")
    db.delete(existing)
    db.commit()


def list_project_tags(db: Session, project_id: str) -> list[Tag]:
    _get_project(db, project_id)
    return (
        db.query(Tag)
        .join(ProjectTag, ProjectTag.tag_id == Tag.id)
        .filter(ProjectTag.project_id == project_id)
        .order_by(Tag.name.asc())
        .all()
    )


__all__ = [
    "assign_subject_to_project",
    "assign_tag_to_project",
    "create_subject",
    "create_tag",
    "delete_subject",
    "delete_tag",
    "get_subject",
    "get_tag",
    "list_project_subjects",
    "list_project_tags",
    "list_subjects",
    "list_tags_for_user",
    "unassign_subject_from_project",
    "unassign_tag_from_project",
    "update_subject",
    "update_tag",
]
