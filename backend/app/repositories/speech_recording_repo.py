"""Repository for the SpeechRecording row (engine#68 idea 3).

Trivial CRUD - unlike ``LessonProgressRepository`` there is no merge /
lifecycle logic, so no dedicated service layer sits above this; the
router calls it directly.
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy.orm import Session

from app.models import SpeechRecording
from app.repositories.base import Repository


class SpeechRecordingRepository(Repository):
    """Persistence contract for speech-recording rows."""

    @abstractmethod
    def find(
        self,
        *,
        user_id: str,
        source: str,
        set_id: str,
        lesson_filename: str,
        exercise_id: str,
    ) -> SpeechRecording | None:
        """Return the row for the composite key, or ``None``."""

    @abstractmethod
    def add(self, row: SpeechRecording) -> None:
        """Stage a new row for insertion (no flush/commit)."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes so a new id is visible."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction."""

    @abstractmethod
    def refresh(self, row: SpeechRecording) -> None:
        """Refresh the row from the database after commit."""

    @abstractmethod
    def delete(self, row: SpeechRecording) -> None:
        """Delete one row (no flush/commit)."""


class SqlAlchemySpeechRecordingRepository(SpeechRecordingRepository):
    """SQLAlchemy-backed :class:`SpeechRecordingRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def find(
        self,
        *,
        user_id: str,
        source: str,
        set_id: str,
        lesson_filename: str,
        exercise_id: str,
    ) -> SpeechRecording | None:
        return (
            self._db.query(SpeechRecording)
            .filter(
                SpeechRecording.user_id == user_id,
                SpeechRecording.source == source,
                SpeechRecording.set_id == set_id,
                SpeechRecording.lesson_filename == lesson_filename,
                SpeechRecording.exercise_id == exercise_id,
            )
            .one_or_none()
        )

    def add(self, row: SpeechRecording) -> None:
        self._db.add(row)

    def flush(self) -> None:
        self._db.flush()

    def commit(self) -> None:
        self._db.commit()

    def refresh(self, row: SpeechRecording) -> None:
        self._db.refresh(row)

    def delete(self, row: SpeechRecording) -> None:
        self._db.delete(row)


__all__ = ["SpeechRecordingRepository", "SqlAlchemySpeechRecordingRepository"]
