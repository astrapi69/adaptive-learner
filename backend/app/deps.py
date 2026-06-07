"""FastAPI composition root for repository dependency injection.

This module is the ONLY place that knows both FastAPI (``Depends``)
and the concrete SQLAlchemy repository implementations. Keeping the
wiring here lets the :mod:`app.repositories` package stay HTTP-free and
lets routers depend on the abstract repository interfaces.

Each provider binds a repository to the request-scoped ``Session``
yielded by :func:`app.database.get_db`. FastAPI caches sub-dependency
results within a request, so a handler depending on both ``get_db``
and a repository provider shares one ``Session`` (and therefore one
transaction).
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.curriculum_repo import (
    CurriculumRepository,
    SqlAlchemyCurriculumRepository,
)
from app.repositories.imports_repo import (
    ImportsRepository,
    SqlAlchemyImportsRepository,
)
from app.repositories.projects_repo import (
    ProjectsRepository,
    SqlAlchemyProjectsRepository,
)
from app.repositories.users_repo import (
    SqlAlchemyUsersRepository,
    UsersRepository,
)


def get_imports_repo(db: Session = Depends(get_db)) -> ImportsRepository:
    """Provide an :class:`ImportsRepository` bound to the request session."""
    return SqlAlchemyImportsRepository(db)


def get_curriculum_repo(db: Session = Depends(get_db)) -> CurriculumRepository:
    """Provide a :class:`CurriculumRepository` bound to the request session."""
    return SqlAlchemyCurriculumRepository(db)


def get_users_repo(db: Session = Depends(get_db)) -> UsersRepository:
    """Provide a :class:`UsersRepository` bound to the request session."""
    return SqlAlchemyUsersRepository(db)


def get_projects_repo(db: Session = Depends(get_db)) -> ProjectsRepository:
    """Provide a :class:`ProjectsRepository` bound to the request session."""
    return SqlAlchemyProjectsRepository(db)


__all__ = [
    "get_curriculum_repo",
    "get_imports_repo",
    "get_projects_repo",
    "get_users_repo",
]
