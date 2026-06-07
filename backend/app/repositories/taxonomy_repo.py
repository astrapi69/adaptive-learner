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
    def get_subject_by_id(self, subject_id: str) -> Subject | None: ...

    @abstractmethod
    def create_subject(
        self, *, parent_id: str | None, name: str, description: str | None, icon: str | None
    ) -> Subject: ...

    @abstractmethod
    def list_subjects(self) -> list[Subject]: ...

    @abstractmethod
    def apply_subject_update(self, row: Subject, fields: Mapping[str, object]) -> Subject: ...

    @abstractmethod
    def delete_subject(self, row: Subject) -> None: ...

    # --- Tag ---------------------------------------------------------------
    @abstractmethod
    def get_user(self, user_id: str) -> User | None: ...

    @abstractmethod
    def get_tag_by_id(self, tag_id: str) -> Tag | None: ...

    @abstractmethod
    def find_tag_by_name(
        self, user_id: str, name: str, *, exclude_id: str | None = None
    ) -> Tag | None: ...

    @abstractmethod
    def create_tag(self, *, user_id: str, name: str, color: str | None) -> Tag: ...

    @abstractmethod
    def list_tags_by_user(self, user_id: str) -> list[Tag]: ...

    @abstractmethod
    def apply_tag_update(self, row: Tag, fields: Mapping[str, object]) -> Tag: ...

    @abstractmethod
    def delete_tag(self, row: Tag) -> None: ...

    # --- Project associations ---------------------------------------------
    @abstractmethod
    def get_project_by_id(self, project_id: str) -> LearningProject | None: ...

    @abstractmethod
    def find_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject | None: ...

    @abstractmethod
    def create_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject: ...

    @abstractmethod
    def delete_project_subject(self, row: ProjectSubject) -> None: ...

    @abstractmethod
    def list_project_subjects(self, project_id: str) -> list[Subject]: ...

    @abstractmethod
    def find_project_tag(self, project_id: str, tag_id: str) -> ProjectTag | None: ...

    @abstractmethod
    def create_project_tag(self, project_id: str, tag_id: str) -> ProjectTag: ...

    @abstractmethod
    def delete_project_tag(self, row: ProjectTag) -> None: ...

    @abstractmethod
    def list_project_tags(self, project_id: str) -> list[Tag]: ...


class SqlAlchemyTaxonomyRepository(TaxonomyRepository):
    """SQLAlchemy-backed :class:`TaxonomyRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # --- Subject -----------------------------------------------------------
    def get_subject_by_id(self, subject_id: str) -> Subject | None:
        return self._db.get(Subject, subject_id)

    def create_subject(
        self, *, parent_id: str | None, name: str, description: str | None, icon: str | None
    ) -> Subject:
        row = Subject(parent_id=parent_id, name=name, description=description, icon=icon)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def list_subjects(self) -> list[Subject]:
        return self._db.query(Subject).order_by(Subject.name.asc()).all()

    def apply_subject_update(self, row: Subject, fields: Mapping[str, object]) -> Subject:
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_subject(self, row: Subject) -> None:
        self._db.delete(row)
        self._db.commit()

    # --- Tag ---------------------------------------------------------------
    def get_user(self, user_id: str) -> User | None:
        return self._db.get(User, user_id)

    def get_tag_by_id(self, tag_id: str) -> Tag | None:
        return self._db.get(Tag, tag_id)

    def find_tag_by_name(
        self, user_id: str, name: str, *, exclude_id: str | None = None
    ) -> Tag | None:
        query = self._db.query(Tag).filter(Tag.user_id == user_id, Tag.name == name)
        if exclude_id is not None:
            query = query.filter(Tag.id != exclude_id)
        return query.first()

    def create_tag(self, *, user_id: str, name: str, color: str | None) -> Tag:
        row = Tag(user_id=user_id, name=name, color=color)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def list_tags_by_user(self, user_id: str) -> list[Tag]:
        return self._db.query(Tag).filter(Tag.user_id == user_id).order_by(Tag.name.asc()).all()

    def apply_tag_update(self, row: Tag, fields: Mapping[str, object]) -> Tag:
        for field, value in fields.items():
            setattr(row, field, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_tag(self, row: Tag) -> None:
        self._db.delete(row)
        self._db.commit()

    # --- Project associations ---------------------------------------------
    def get_project_by_id(self, project_id: str) -> LearningProject | None:
        return self._db.get(LearningProject, project_id)

    def find_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject | None:
        return (
            self._db.query(ProjectSubject)
            .filter(
                ProjectSubject.project_id == project_id,
                ProjectSubject.subject_id == subject_id,
            )
            .first()
        )

    def create_project_subject(self, project_id: str, subject_id: str) -> ProjectSubject:
        row = ProjectSubject(project_id=project_id, subject_id=subject_id)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_project_subject(self, row: ProjectSubject) -> None:
        self._db.delete(row)
        self._db.commit()

    def list_project_subjects(self, project_id: str) -> list[Subject]:
        return (
            self._db.query(Subject)
            .join(ProjectSubject, ProjectSubject.subject_id == Subject.id)
            .filter(ProjectSubject.project_id == project_id)
            .order_by(Subject.name.asc())
            .all()
        )

    def find_project_tag(self, project_id: str, tag_id: str) -> ProjectTag | None:
        return (
            self._db.query(ProjectTag)
            .filter(ProjectTag.project_id == project_id, ProjectTag.tag_id == tag_id)
            .first()
        )

    def create_project_tag(self, project_id: str, tag_id: str) -> ProjectTag:
        row = ProjectTag(project_id=project_id, tag_id=tag_id)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete_project_tag(self, row: ProjectTag) -> None:
        self._db.delete(row)
        self._db.commit()

    def list_project_tags(self, project_id: str) -> list[Tag]:
        return (
            self._db.query(Tag)
            .join(ProjectTag, ProjectTag.tag_id == Tag.id)
            .filter(ProjectTag.project_id == project_id)
            .order_by(Tag.name.asc())
            .all()
        )


__all__ = ["TaxonomyRepository", "SqlAlchemyTaxonomyRepository"]
