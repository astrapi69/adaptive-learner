"""The retirement reason of an element row rides the backup (#3952).

Format 1.10.0 adds ``retired_reason`` to ``element_errors``. The export
carries it, the restore writes it back, and a backup from a build that did
not know the field has its retired rows restored as retired by their author,
the only cause there was.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.models import ElementError, User
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.services.backup_export import BACKUP_FORMAT, BACKUP_VERSION, create_backup
from app.services.backup_restore import restore_backup

RETIRED_AT = datetime(2026, 11, 20, 10, 0, tzinfo=UTC)


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Direct SQLAlchemy session bound to the in-memory test DB."""
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def user(db_session: Session) -> User:
    learner = User(name="Aster", email=None, language="de")
    db_session.add(learner)
    db_session.commit()
    return learner


def _row(user_id: str, **fields: Any) -> ElementError:
    now = datetime(2026, 11, 1, 9, 0, tzinfo=UTC)
    return ElementError(
        id="row-1",
        user_id=user_id,
        set_id="fr-a1",
        lesson_id="01-intro.json",
        exercise_id="gone-ex",
        element_key="merci",
        element_type="vocabulary",
        user_answer="x",
        correct_answer="merci",
        error_count=1,
        correct_streak=0,
        last_attempt_at=now,
        created_at=now,
        updated_at=now,
        **fields,
    )


def _exported_row(db: Session, user_id: str) -> dict[str, Any]:
    payload = create_backup(SqlAlchemyBackupRepository(db), user_id)
    [row] = payload["data"]["element_errors"]
    return row


def test_the_format_version_names_the_new_field() -> None:
    assert BACKUP_VERSION == "1.10.0"


@pytest.mark.parametrize(
    "reason",
    ["author", "exercise_missing", "lesson_missing", "element_missing", "superseded"],
)
def test_the_reason_survives_export_and_restore(
    db_session: Session, user: User, reason: str
) -> None:
    db_session.add(_row(user.id, retired_at=RETIRED_AT, retired_reason=reason))
    db_session.commit()
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    assert payload["data"]["element_errors"][0]["retired_reason"] == reason

    db_session.query(ElementError).delete()
    db_session.commit()
    restore_backup(SqlAlchemyBackupRepository(db_session), payload)

    restored = db_session.query(ElementError).one()
    assert restored.retired_reason == reason
    assert restored.retired_at is not None


def test_an_active_row_exports_no_reason(db_session: Session, user: User) -> None:
    db_session.add(_row(user.id))
    db_session.commit()
    assert _exported_row(db_session, user.id)["retired_reason"] is None


def test_a_backup_without_the_field_restores_its_retired_row_as_author_retired(
    db_session: Session, user: User
) -> None:
    db_session.add(_row(user.id, retired_at=RETIRED_AT, retired_reason="author"))
    db_session.commit()
    row = _exported_row(db_session, user.id)
    del row["retired_reason"]
    older = {
        "format": BACKUP_FORMAT,
        "version": "1.9.0",
        "user_id": user.id,
        "storage_mode": "api",
        "data": {"element_errors": [row]},
    }
    db_session.query(ElementError).delete()
    db_session.commit()

    restore_backup(SqlAlchemyBackupRepository(db_session), older)

    restored = db_session.query(ElementError).one()
    assert restored.retired_at is not None
    assert restored.retired_reason == "author"
