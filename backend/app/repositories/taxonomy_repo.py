"""Repository for the Subject / Tag / project-association aggregates
(Phase 22C; EXP-024 Phase 1).

Subjects are global; tags are per-user; the two association tables are
M:N. Uniqueness/ownership rules and domain errors stay in
``app.services.taxonomy``; this layer only reads and writes rows.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.models import (
    LearningProject,
    ProjectSubject,
    ProjectTag,
    Subject,
    Tag,
    User,
)
from app.repositories.base import Repository


class TaxonomyRepository(Repository):
    """Persistence contract for subjects, tags, and project associations."""

    # --- Subject -----------------------------------------------------------
    @abstractmethod
    def get_subject_by_id(self, subject_id: str) -> Subject | None:
        """Return the subject row, or ``None`` when it does not exist."""

    @abstractmethod
    def create_subject(
        self, *, parent_id: str | None, name: str, description: str | None, icon: str | None
    ) -> Subject:
        """Insert a subject and return it."""

    @abstractmethod
    def list_subjects(self) -> list[Subject]:
        """Return all subjects, ordered alphabetically by name."""

    @abstractmethod
    def apply_subject_update(self, row: Subject, fields: Mapping[str, object]) -> Subject:
        """Set the given attributes on the subject, persist, and return it."""

    @abstractmethod
    def delete_subject(self, row: Subject) -> None:
        """Delete the subject row and commit."""

    # --- Tag ---------------------------------------------------------------
    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def get_tag_by_id(self, tag_id: str) -> Tag | None:
        """Return the tag row, or ``None`` when it does not exist."""

    @abstractmethod
    def find_tag_by_name(
        self, user_id: str, name: str, *, exclude_id: str | None = None
    ) -> Tag | None:
        """Return the user's tag with the given name, or ``None``.

        Args:
            user_id: Owner of the tag (tags are per-user).
            name: Exact tag name to match.
            exclude_id: Tag id to exclude, used to ignore the row being
                renamed during a uniqueness check.
        """

    @abstractmethod
    def create_tag(self, *, user_id: str, name: str, color: str | None) -> Tag:
        """Insert a tag for the user and return it."""

    @abstractmethod
    def list_tags_by_user(self, user_id: str) -> list[Tag]:
        """Return the user's tags, ordered alphabetically by name."""

    @abstractmethod
    def apply_tag_update(self, row: Tag, fields: Mapping[str, object]) -> Tag:
        """Set the given attributes on the tag, persist, and return it."""

    @abstractmethod
    def delete_tag(self, row: Tag) -> None:
        """Delete the tag row and commit."""

    # --- Project associations ---------------------------------------------
    @abstractmethod
    def get_project_by_id(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""

    @abstractmethod
    def find_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject | None:
        """Return the (project, subject) association row, or ``None``."""

    @abstractmethod
    def create_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject:
        """Insert a (project, subject) association and return it."""

    @abstractmethod
    def delete_project_subject(self, row: ProjectSubject) -> None:
        """Delete the (project, subject) association row and commit."""

    @abstractmethod
    def list_project_subjects(self, project_id: str) -> list[Subject]:
        """Return the subjects linked to the project, ordered by name."""

    @abstractmethod
    def find_project_tag(self, project_id: str, tag_id: str) -> ProjectTag | None:
        """Return the (project, tag) association row, or ``None``."""

    @abstractmethod
    def create_project_tag(self, project_id: str, tag_id: str) -> ProjectTag:
        """Insert a (project, tag) association and return it."""

    @abstractmethod
    def delete_project_tag(self, row: ProjectTag) -> None:
        """Delete the (project, tag) association row and commit."""

    @abstractmethod
    def list_project_tags(self, project_id: str) -> list[Tag]:
        """Return the tags linked to the project, ordered by name."""


class SqlAlchemyTaxonomyRepository(TaxonomyRepository):
    """SQLAlchemy-backed :class:`TaxonomyRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # --- Subject -----------------------------------------------------------
    def get_subject_by_id(self, subject_id: str) -> Subject | None:
        """Return the subject row, or ``None`` when it does not exist."""
        return self._db.get(Subject, subject_id)

    def create_subject(
        self, *, parent_id: str | None, name: str, description: str | None, icon: str | None
    ) -> Subject:
        """Insert a subject and return the committed row."""
        row = Subject(parent_id=parent_id, name=name, description=description, icon=icon)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def list_subjects(self) -> list[Subject]:
        """Return all subjects, ordered alphabetically by name."""
        return self._db.query(Subject).order_by(Subject.name.asc()).all()

    def apply_subject_update(self, row: Subject, fields: Mapping[str, object]) -> Subject:
        """Set the given attributes on the subject, persist, and return it."""
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_subject(self, row: Subject) -> None:
        """Delete the subject row and commit."""
        self._db.delete(row)
        self._db.commit()

    # --- Tag ---------------------------------------------------------------
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""
        return self._db.get(User, user_id)

    def get_tag_by_id(self, tag_id: str) -> Tag | None:
        """Return the tag row, or ``None`` when it does not exist."""
        return self._db.get(Tag, tag_id)

    def find_tag_by_name(
        self, user_id: str, name: str, *, exclude_id: str | None = None
    ) -> Tag | None:
        """Return the user's tag with the given name, or ``None``.

        Excludes ``exclude_id`` when given, so a rename can check name
        uniqueness without matching the row being renamed.
        """
        query = self._db.query(Tag).filter(Tag.user_id == user_id, Tag.name == name)
        if exclude_id is not None:
            query = query.filter(Tag.id != exclude_id)
        return query.first()

    def create_tag(self, *, user_id: str, name: str, color: str | None) -> Tag:
        """Insert a tag for the user and return the committed row."""
        row = Tag(user_id=user_id, name=name, color=color)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def list_tags_by_user(self, user_id: str) -> list[Tag]:
        """Return the user's tags, ordered alphabetically by name."""
        return self._db.query(Tag).filter(Tag.user_id == user_id).order_by(Tag.name.asc()).all()

    def apply_tag_update(self, row: Tag, fields: Mapping[str, object]) -> Tag:
        """Set the given attributes on the tag, persist, and return it."""
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_tag(self, row: Tag) -> None:
        """Delete the tag row and commit."""
        self._db.delete(row)
        self._db.commit()

    # --- Project associations ---------------------------------------------
    def get_project_by_id(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""
        return self._db.get(LearningProject, project_id)

    def find_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject | None:
        """Return the (project, subject) association row, or ``None``."""
        return (
            self._db.query(ProjectSubject)
            .filter(
                ProjectSubject.project_id == project_id,
                ProjectSubject.subject_id == subject_id,
            )
            .first()
        )

    def create_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject:
        """Insert a (project, subject) association and return the row."""
        row = ProjectSubject(project_id=project_id, subject_id=subject_id)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_project_subject(self, row: ProjectSubject) -> None:
        """Delete the (project, subject) association row and commit."""
        self._db.delete(row)
        self._db.commit()

    def list_project_subjects(self, project_id: str) -> list[Subject]:
        """Return the subjects linked to the project, ordered by name."""
        return (
            self._db.query(Subject)
            .join(ProjectSubject, ProjectSubject.subject_id == Subject.id)
            .filter(ProjectSubject.project_id == project_id)
            .order_by(Subject.name.asc())
            .all()
        )

    def find_project_tag(self, project_id: str, tag_id: str) -> ProjectTag | None:
        """Return the (project, tag) association row, or ``None``."""
        return (
            self._db.query(ProjectTag)
            .filter(ProjectTag.project_id == project_id, ProjectTag.tag_id == tag_id)
            .first()
        )

    def create_project_tag(self, project_id: str, tag_id: str) -> ProjectTag:
        """Insert a (project, tag) association and return the row."""
        row = ProjectTag(project_id=project_id, tag_id=tag_id)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_project_tag(self, row: ProjectTag) -> None:
        """Delete the (project, tag) association row and commit."""
        self._db.delete(row)
        self._db.commit()

    def list_project_tags(self, project_id: str) -> list[Tag]:
        """Return the tags linked to the project, ordered by name."""
        return (
            self._db.query(Tag)
            .join(ProjectTag, ProjectTag.tag_id == Tag.id)
            .filter(ProjectTag.project_id == project_id)
            .order_by(Tag.name.asc())
            .all()
        )


__all__ = ["TaxonomyRepository", "SqlAlchemyTaxonomyRepository"]
