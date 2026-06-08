"""Repository for UserSettings + ApiKeyBackup (Phase 1C-D; EXP-024 Phase 1).

Owns the DB persistence for the settings surface: the per-user
``UserSettings`` row (get-or-create with the first-access race guard)
and the ``ApiKeyBackup`` rows. The provider-column mapping, the
env/secrets.yaml resolution chain, Fernet crypto, and domain errors
stay in ``app.services.settings``; this layer only reads and writes
rows.
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import ApiKeyBackup, User, UserSettings
from app.repositories.base import Repository


class SettingsRepository(Repository):
    """Persistence contract for user settings and api-key backups."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def get_or_create_settings(self, user: User) -> UserSettings:
        """Return the user's settings row, creating it on first access.

        Idempotent and race-safe: a concurrent first-access that loses
        the ``unique(user_id)`` insert re-reads the committed row.
        """

    @abstractmethod
    def persist(self, settings: UserSettings) -> None:
        """Commit pending changes and refresh the settings row.

        Commits the whole transaction (so a sibling ``User`` change in
        the same unit of work lands too) and refreshes ``settings``.
        """

    @abstractmethod
    def get_api_key_backup(self, user_id: str, provider_value: str) -> ApiKeyBackup | None:
        """Return the backup row for (user, provider), or ``None``."""

    @abstractmethod
    def upsert_api_key_backup(
        self, *, user_id: str, provider_value: str, encrypted_key: str
    ) -> None:
        """Insert or update the single per-(user, provider) backup row."""


class SqlAlchemySettingsRepository(SettingsRepository):
    """SQLAlchemy-backed :class:`SettingsRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        return self._db.get(User, user_id)

    def get_or_create_settings(self, user: User) -> UserSettings:
        if user.settings is not None:
            return user.settings
        settings = UserSettings(user_id=user.id)
        self._db.add(settings)
        try:
            self._db.commit()
        except IntegrityError:
            # Concurrent first-access (React 18 strict-mode double-effect
            # or parallel GETs): the other request won the unique insert.
            self._db.rollback()
            self._db.refresh(user, attribute_names=["settings"])
            if user.settings is None:
                raise
            return user.settings
        self._db.refresh(settings)
        _ = settings.user
        return settings

    def persist(self, settings: UserSettings) -> None:
        self._db.commit()
        self._db.refresh(settings)

    def get_api_key_backup(self, user_id: str, provider_value: str) -> ApiKeyBackup | None:
        return (
            self._db.query(ApiKeyBackup)
            .filter(
                ApiKeyBackup.user_id == user_id,
                ApiKeyBackup.provider == provider_value,
            )
            .one_or_none()
        )

    def upsert_api_key_backup(
        self, *, user_id: str, provider_value: str, encrypted_key: str
    ) -> None:
        existing = self.get_api_key_backup(user_id, provider_value)
        if existing is None:
            self._db.add(
                ApiKeyBackup(
                    user_id=user_id,
                    provider=provider_value,
                    encrypted_key=encrypted_key,
                    works=True,
                )
            )
        else:
            existing.encrypted_key = encrypted_key
            existing.works = True
        self._db.commit()


__all__ = ["SettingsRepository", "SqlAlchemySettingsRepository"]
