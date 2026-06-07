"""Subject + Tag + project-association CRUD (Phase 22C; EXP-024 migration).

Subjects are GLOBAL — no per-user scoping. Tags are per-user
(unique on ``(user_id, name)``). Both association tables
(``project_subjects``, ``project_tags``) are M:N with a unique
pair constraint; duplicate assignments are no-ops, not errors.

Business layer over :class:`TaxonomyRepository`: validates, surfaces
clean :class:`AdaptiveLearnerError` subclasses (the global handler in
:mod:`app.main` maps them to HTTP codes), and never touches SQLAlchemy.
"""

from __future__ import annotations

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    LearningProject,
    ProjectSubject,
    ProjectTag,
    Subject,
    Tag,
)
from app.repositories.taxonomy_repo import TaxonomyRepository
from app.schemas import (
    SubjectCreate,
    SubjectUpdate,
    TagCreate,
    TagUpdate,
)

# --- Subject CRUD ----------------------------------------------------------


def create_subject(repo: TaxonomyRepository, payload: SubjectCreate) -> Subject:
    if payload.parent_id is not None and repo.get_subject_by_id(payload.parent_id) is None:
        raise NotFoundError(f"Parent subject {payload.parent_id!r} not found.")
    return repo.create_subject(
        parent_id=payload.parent_id,
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
    )


def get_subject(repo: TaxonomyRepository, subject_id: str) -> Subject:
    row = repo.get_subject_by_id(subject_id)
    if row is None:
        raise NotFoundError(f"Subject {subject_id!r} not found.")
    return row


def list_subjects(repo: TaxonomyRepository) -> list[Subject]:
    """Return every subject. The frontend rebuilds the tree from
    the flat list via the TypedTreeNode adapter (same shape as
    ``LearningTopic``)."""
    return repo.list_subjects()


def update_subject(repo: TaxonomyRepository, subject_id: str, payload: SubjectUpdate) -> Subject:
    row = get_subject(repo, subject_id)
    updates = payload.model_dump(exclude_unset=True)
    if "parent_id" in updates and updates["parent_id"] is not None:
        if updates["parent_id"] == subject_id:
            raise ValidationError("Subject cannot be its own parent.")
        if repo.get_subject_by_id(updates["parent_id"]) is None:
            raise NotFoundError(f"Parent subject {updates['parent_id']!r} not found.")
    return repo.apply_subject_update(row, updates)


def delete_subject(repo: TaxonomyRepository, subject_id: str) -> None:
    """Delete one subject. Children detach (``ondelete=SET NULL``);
    the subject's project-associations cascade via the M:N table's
    FK to ``subjects.id``."""
    row = get_subject(repo, subject_id)
    repo.delete_subject(row)


# --- Tag CRUD --------------------------------------------------------------


def create_tag(repo: TaxonomyRepository, user_id: str, payload: TagCreate) -> Tag:
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    # The DB has a uniqueness constraint on (user_id, name), but
    # surface a clean ConflictError instead of an IntegrityError.
    if repo.find_tag_by_name(user_id, payload.name) is not None:
        raise ConflictError(f"Tag {payload.name!r} already exists for this user.")
    return repo.create_tag(user_id=user_id, name=payload.name, color=payload.color)


def get_tag(repo: TaxonomyRepository, tag_id: str) -> Tag:
    row = repo.get_tag_by_id(tag_id)
    if row is None:
        raise NotFoundError(f"Tag {tag_id!r} not found.")
    return row


def list_tags_for_user(repo: TaxonomyRepository, user_id: str) -> list[Tag]:
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return repo.list_tags_by_user(user_id)


def update_tag(repo: TaxonomyRepository, tag_id: str, payload: TagUpdate) -> Tag:
    row = get_tag(repo, tag_id)
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != row.name:
        clash = repo.find_tag_by_name(row.user_id, updates["name"], exclude_id=tag_id)
        if clash is not None:
            raise ConflictError(f"Tag {updates['name']!r} already exists for this user.")
    return repo.apply_tag_update(row, updates)


def delete_tag(repo: TaxonomyRepository, tag_id: str) -> None:
    row = get_tag(repo, tag_id)
    repo.delete_tag(row)


# --- Project associations --------------------------------------------------


def _get_project(repo: TaxonomyRepository, project_id: str) -> LearningProject:
    project = repo.get_project_by_id(project_id)
    if project is None:
        raise NotFoundError(f"Project {project_id!r} not found.")
    return project


def assign_subject_to_project(
    repo: TaxonomyRepository, project_id: str, subject_id: str
) -> ProjectSubject:
    _get_project(repo, project_id)
    if repo.get_subject_by_id(subject_id) is None:
        raise NotFoundError(f"Subject {subject_id!r} not found.")
    existing = repo.find_project_subject(project_id, subject_id)
    if existing is not None:
        return existing  # idempotent
    return repo.create_project_subject(project_id, subject_id)


def unassign_subject_from_project(
    repo: TaxonomyRepository, project_id: str, subject_id: str
) -> None:
    existing = repo.find_project_subject(project_id, subject_id)
    if existing is None:
        raise NotFoundError(f"Subject {subject_id!r} is not assigned to project {project_id!r}.")
    repo.delete_project_subject(existing)


def list_project_subjects(repo: TaxonomyRepository, project_id: str) -> list[Subject]:
    _get_project(repo, project_id)
    return repo.list_project_subjects(project_id)


def assign_tag_to_project(repo: TaxonomyRepository, project_id: str, tag_id: str) -> ProjectTag:
    project = _get_project(repo, project_id)
    tag = repo.get_tag_by_id(tag_id)
    if tag is None:
        raise NotFoundError(f"Tag {tag_id!r} not found.")
    # Defensive: a tag belongs to a user; the project must belong
    # to the SAME user. Cross-user tagging is meaningless.
    if tag.user_id != project.user_id:
        raise ValidationError("Tag and project belong to different users.")
    existing = repo.find_project_tag(project_id, tag_id)
    if existing is not None:
        return existing
    return repo.create_project_tag(project_id, tag_id)


def unassign_tag_from_project(repo: TaxonomyRepository, project_id: str, tag_id: str) -> None:
    existing = repo.find_project_tag(project_id, tag_id)
    if existing is None:
        raise NotFoundError(f"Tag {tag_id!r} is not assigned to project {project_id!r}.")
    repo.delete_project_tag(existing)


def list_project_tags(repo: TaxonomyRepository, project_id: str) -> list[Tag]:
    _get_project(repo, project_id)
    return repo.list_project_tags(project_id)


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
