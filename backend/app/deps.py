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
from app.repositories.backup_repo import (
    BackupRepository,
    SqlAlchemyBackupRepository,
)
from app.repositories.curriculum_repo import (
    CurriculumRepository,
    SqlAlchemyCurriculumRepository,
)
from app.repositories.element_errors_repo import (
    ElementErrorsRepository,
    SqlAlchemyElementErrorsRepository,
)
from app.repositories.export_repo import (
    ExportRepository,
    SqlAlchemyExportRepository,
)
from app.repositories.imports_repo import (
    ImportsRepository,
    SqlAlchemyImportsRepository,
)
from app.repositories.lesson_progress_repo import (
    LessonProgressRepository,
    SqlAlchemyLessonProgressRepository,
)
from app.repositories.lesson_session_unification_repo import (
    LessonSessionUnificationRepository,
    SqlAlchemyLessonSessionUnificationRepository,
)
from app.repositories.projects_repo import (
    ProjectsRepository,
    SqlAlchemyProjectsRepository,
)
from app.repositories.reset_repo import (
    ResetRepository,
    SqlAlchemyResetRepository,
)
from app.repositories.set_runs_repo import (
    SetRunsRepository,
    SqlAlchemySetRunsRepository,
)
from app.repositories.settings_repo import (
    SettingsRepository,
    SqlAlchemySettingsRepository,
)
from app.repositories.sync_repo import (
    SqlAlchemySyncRepository,
    SyncRepository,
)
from app.repositories.taxonomy_repo import (
    SqlAlchemyTaxonomyRepository,
    TaxonomyRepository,
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


def get_taxonomy_repo(db: Session = Depends(get_db)) -> TaxonomyRepository:
    """Provide a :class:`TaxonomyRepository` bound to the request session."""
    return SqlAlchemyTaxonomyRepository(db)


def get_settings_repo(db: Session = Depends(get_db)) -> SettingsRepository:
    """Provide a :class:`SettingsRepository` bound to the request session."""
    return SqlAlchemySettingsRepository(db)


def get_reset_repo(db: Session = Depends(get_db)) -> ResetRepository:
    """Provide a :class:`ResetRepository` bound to the request session."""
    return SqlAlchemyResetRepository(db)


def get_export_repo(db: Session = Depends(get_db)) -> ExportRepository:
    """Provide an :class:`ExportRepository` bound to the request session."""
    return SqlAlchemyExportRepository(db)


def get_backup_repo(db: Session = Depends(get_db)) -> BackupRepository:
    """Provide a :class:`BackupRepository` bound to the request session."""
    return SqlAlchemyBackupRepository(db)


def get_sync_repo(db: Session = Depends(get_db)) -> SyncRepository:
    """Provide a :class:`SyncRepository` bound to the request session."""
    return SqlAlchemySyncRepository(db)


def get_element_errors_repo(db: Session = Depends(get_db)) -> ElementErrorsRepository:
    """Provide an :class:`ElementErrorsRepository` bound to the request session."""
    return SqlAlchemyElementErrorsRepository(db)


def get_set_runs_repo(db: Session = Depends(get_db)) -> SetRunsRepository:
    """Provide a :class:`SetRunsRepository` bound to the request session."""
    return SqlAlchemySetRunsRepository(db)


def get_lesson_progress_repo(db: Session = Depends(get_db)) -> LessonProgressRepository:
    """Provide a :class:`LessonProgressRepository` bound to the request session."""
    return SqlAlchemyLessonProgressRepository(db)


def get_lesson_session_unification_repo(
    db: Session = Depends(get_db),
) -> LessonSessionUnificationRepository:
    """Provide a :class:`LessonSessionUnificationRepository` bound to the session."""
    return SqlAlchemyLessonSessionUnificationRepository(db)


__all__ = [
    "get_backup_repo",
    "get_curriculum_repo",
    "get_element_errors_repo",
    "get_export_repo",
    "get_imports_repo",
    "get_lesson_progress_repo",
    "get_lesson_session_unification_repo",
    "get_projects_repo",
    "get_reset_repo",
    "get_set_runs_repo",
    "get_settings_repo",
    "get_sync_repo",
    "get_taxonomy_repo",
    "get_users_repo",
]
