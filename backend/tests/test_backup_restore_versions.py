"""A backup restore compares format versions (#3827).

A backup from a newer app is restored with whatever this build knows, and the
summary names the segments it skipped. A newer major format, or a version that
cannot be read, is rejected before anything is written.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.models import Tag, User
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.routers.backup import router as backup_router
from app.routers.users import router as users_router
from app.services.backup_export import BACKUP_FORMAT, BACKUP_VERSION
from app.services.backup_restore import restore_backup
from tests.router_test_client import make_client


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Direct SQLAlchemy session bound to the in-memory test DB."""
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _user(db: Session) -> User:
    user = User(name="Aster", email=None, language="de")
    db.add(user)
    db.commit()
    return user


def _payload(user_id: str, version: str, **extra: Any) -> dict[str, Any]:
    data = extra.pop("data", {})
    return {
        "format": BACKUP_FORMAT,
        "version": version,
        "user_id": user_id,
        "storage_mode": "api",
        "data": {"tags": [{"id": "t-1", "user_id": user_id, "name": "kept"}], **data},
        **extra,
    }


def _restore(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    return restore_backup(SqlAlchemyBackupRepository(db), payload)


def test_restore_names_skipped_segments_when_the_backup_is_newer(db_session: Session) -> None:
    user = _user(db_session)
    summary = _restore(
        db_session,
        _payload(
            user.id,
            "1.10.0",
            data={"future_table": [{"id": "f-1"}], "empty_future": []},
            future_block={"anything": True},
            empty_block={},
        ),
    )
    assert summary["tables"]["tags"]["inserted"] == 1
    assert summary["newer_version"] == "1.10.0"
    assert summary["skipped_segments"] == ["future_block", "future_table"]


def test_restore_reports_a_newer_version_without_unknown_segments(db_session: Session) -> None:
    user = _user(db_session)
    summary = _restore(db_session, _payload(user.id, "1.10.0"))
    assert summary["newer_version"] == "1.10.0"
    assert summary["skipped_segments"] == []


@pytest.mark.parametrize("version", [BACKUP_VERSION, "1.2.0"], ids=["current", "older"])
def test_restore_stays_quiet_for_a_current_or_older_backup(
    db_session: Session, version: str
) -> None:
    user = _user(db_session)
    summary = _restore(db_session, _payload(user.id, version, data={"future_table": [{"id": "f"}]}))
    assert summary["newer_version"] is None
    assert summary["skipped_segments"] == []


def test_restore_rejects_a_newer_major_version_and_writes_nothing(db_session: Session) -> None:
    user = _user(db_session)
    with pytest.raises(ValidationError, match=r"2\.0\.0.*1\.x"):
        _restore(db_session, _payload(user.id, "2.0.0"))
    assert db_session.query(Tag).count() == 0


@pytest.mark.parametrize(
    "version",
    ["abc", "1.x", "1", " ", "1.9", " 1.9.0", "", None, 13],
    ids=[
        "word",
        "wildcard",
        "bare-major",
        "whitespace",
        "two-parts",
        "padded",
        "empty",
        "none",
        "number",
    ],
)
def test_restore_rejects_an_unreadable_version_and_writes_nothing(
    db_session: Session, version: Any
) -> None:
    user = _user(db_session)
    payload = _payload(user.id, "1.9.0")
    payload["version"] = version
    with pytest.raises(ValidationError, match="cannot be read"):
        _restore(db_session, payload)
    assert db_session.query(Tag).count() == 0


def test_restore_rejects_a_missing_version(db_session: Session) -> None:
    user = _user(db_session)
    payload = _payload(user.id, "1.9.0")
    del payload["version"]
    with pytest.raises(ValidationError, match="cannot be read"):
        _restore(db_session, payload)


# ---- Through the API route (the API-mode path of the frontend) -------------


@pytest.fixture()
def client() -> TestClient:
    return make_client(users_router, backup_router)


def _api_user(client: TestClient) -> str:
    resp = client.post("/api/users", json={"name": "Aster"})
    assert resp.status_code == 201, resp.text
    return str(resp.json()["id"])


def test_import_endpoint_returns_the_newer_backup_report(client: TestClient) -> None:
    user_id = _api_user(client)
    payload = _payload(user_id, "1.10.0", future_block=[{"x": 1}])
    resp = client.post("/api/backup/import", params={"user_id": user_id}, json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json()["newer_version"] == "1.10.0"
    assert resp.json()["skipped_segments"] == ["future_block"]


@pytest.mark.parametrize("version", ["2.0.0", "1.x"], ids=["newer-major", "unreadable"])
def test_import_endpoint_rejects_an_unreadable_or_newer_major_version(
    client: TestClient, version: str
) -> None:
    user_id = _api_user(client)
    payload = _payload(user_id, version)
    resp = client.post("/api/backup/import", params={"user_id": user_id}, json=payload)
    assert resp.status_code == 400, resp.text
