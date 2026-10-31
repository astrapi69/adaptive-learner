"""Every released backup format restores in API mode (#3786).

Each file in ``tests/fixtures/backups/`` was written by the export of the
release it names (see ``SOURCE.md`` there); none was built by hand. Each is
restored into a fresh database, then exported again, and every row the file
carries has to come back out under its id. A hand-built fixture shows only
what its author expected an old file to hold; these show what old releases
actually wrote.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.services.backup_export import create_backup
from app.services.backup_restore import restore_backup

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "backups"
FILES = sorted(FIXTURES.glob("*.json"))

#: The key table: a row from another install cannot be decrypted here, so it
#: is skipped and counted, never restored (#787, #3367).
KEY_TABLE = "api_key_backups"


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Direct SQLAlchemy session bound to the in-memory test DB."""
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _load(path: Path) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return payload


def _ids(rows: list[dict[str, Any]]) -> set[str]:
    return {str(row["id"]) for row in rows if "id" in row}


def _missing(source: dict[str, Any], exported: dict[str, Any]) -> tuple[dict[str, list[str]], int]:
    """Row ids of ``source`` that ``exported`` lacks, per table, and how many were compared."""
    compared = 0
    missing: dict[str, list[str]] = {}
    for table, rows in source["data"].items():
        if table == KEY_TABLE or not rows:
            continue
        ids = _ids(rows)
        compared += len(ids)
        lost = sorted(ids - _ids(exported["data"].get(table, [])))
        if lost:
            missing[table] = lost
    return missing, compared


def _restore_and_export(db: Session, payload: dict[str, Any]) -> tuple[dict, dict]:
    summary = restore_backup(SqlAlchemyBackupRepository(db), payload)
    exported = create_backup(SqlAlchemyBackupRepository(db), payload["user_id"])
    return summary, exported


def test_the_fixture_set_covers_the_formats_the_issue_names() -> None:
    versions = {_load(path)["version"] for path in FILES}
    assert len(FILES) >= 7, f"only {len(FILES)} fixtures in {FIXTURES}"
    assert {"1.2.0", "1.5.0", "1.9.0"} <= versions


@pytest.mark.parametrize("path", FILES, ids=[path.stem for path in FILES])
def test_a_released_backup_restores_every_row_in_api_mode(db_session: Session, path: Path) -> None:
    payload = _load(path)
    summary, exported = _restore_and_export(db_session, payload)
    assert summary["errors"] == []

    missing, compared = _missing(payload, exported)
    assert compared >= 25, f"{path.name}: only {compared} row ids compared"
    assert missing == {}

    keys = payload["data"].get(KEY_TABLE, [])
    restored_keys = summary["tables"].get(KEY_TABLE, {}).get("inserted", 0)
    assert restored_keys + summary["api_keys_skipped"] == len(keys)


def test_a_row_that_does_not_come_back_is_reported(db_session: Session) -> None:
    payload = _load(FIXTURES / "api-1.9.0-v2.17.1.json")
    stranger = {**payload["data"]["tags"][0], "id": "not-restored", "user_id": "someone-else"}
    payload["data"]["tags"] = [*payload["data"]["tags"], stranger]
    _, exported = _restore_and_export(db_session, payload)
    missing, _ = _missing(payload, exported)
    assert missing == {"tags": ["not-restored"]}
