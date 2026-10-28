"""LAN sync carries no API key (#3854).

The sync wire is plain ``http`` on the local network. The desktop never
serves its key columns (Fernet ciphertext) or its ``api_key_backups``
rows, and never writes key values a client pushes or resolves: an older
browser build still sends its cleartext keys, and they must not land in
the ciphertext columns. The browser side is covered by
``frontend/src/storage/sync/sync-secrets.test.ts``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import ApiKeyBackup, User, UserSettings
from app.routers.sync import router as sync_router
from app.services import crypto
from app.services import pairing as pairing_service
from app.services.backup_export import EXCLUDED_USER_SETTINGS_FIELDS
from tests.router_test_client import make_client

DESKTOP_KEY = "sk-ant-desktop-original"
BROWSER_KEY = "sk-ant-browser-cleartext"
FAR_FUTURE = (datetime.now(UTC) + timedelta(days=1)).isoformat()
LONG_AGO = "2020-01-01T00:00:00+00:00"


@pytest.fixture()
def client() -> TestClient:
    pairing_service._reset_for_tests()
    return make_client(sync_router)


@pytest.fixture()
def seeded() -> dict[str, str]:
    """A desktop user with an encrypted live key and its rollback copy."""
    db = SessionLocal()
    try:
        user = User(name="Aster", language="de")
        db.add(user)
        db.flush()
        settings = UserSettings(
            user_id=user.id,
            active_provider="anthropic",
            api_key_anthropic=crypto.encrypt_api_key(DESKTOP_KEY),
        )
        backup = ApiKeyBackup(
            user_id=user.id,
            provider="anthropic",
            encrypted_key=crypto.encrypt_api_key(DESKTOP_KEY),
            tested_at=datetime.now(UTC),
            works=True,
        )
        db.add_all([settings, backup])
        db.commit()
        return {
            "user_id": user.id,
            "settings_id": settings.id,
            "backup_id": backup.id,
            "ciphertext": settings.api_key_anthropic,
        }
    finally:
        db.close()


def _stored_settings(settings_id: str) -> UserSettings:
    db = SessionLocal()
    try:
        return db.get(UserSettings, settings_id)
    finally:
        db.close()


def _browser_settings_record(seeded: dict[str, str], **overrides: object) -> dict[str, object]:
    """A ``user_settings`` row as an older browser build pushes it."""
    record: dict[str, object] = {
        "id": seeded["settings_id"],
        "user_id": seeded["user_id"],
        "active_provider": "openai",
        "updated_at": datetime.now(UTC).isoformat(),
    }
    record.update({field: BROWSER_KEY for field in EXCLUDED_USER_SETTINGS_FIELDS})
    record.update(overrides)
    return record


def test_pull_serves_no_api_key(client: TestClient, seeded: dict[str, str]):
    resp = client.post(
        "/api/sync/pull",
        json={"user_id": seeded["user_id"], "tables": ["user_settings", "api_key_backups"]},
    )
    assert resp.status_code == 200, resp.text
    records = resp.json()["records"]
    settings_rows = records["user_settings"]
    assert len(settings_rows) == 1
    assert settings_rows[0]["active_provider"] == "anthropic"
    for field in EXCLUDED_USER_SETTINGS_FIELDS:
        assert field not in settings_rows[0]
    assert records.get("api_key_backups", []) == []
    assert seeded["ciphertext"] not in resp.text


def test_push_never_writes_a_pushed_key(client: TestClient, seeded: dict[str, str]):
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": seeded["user_id"],
            "table": "user_settings",
            "since": FAR_FUTURE,
            "records": [_browser_settings_record(seeded)],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["accepted"] == [seeded["settings_id"]]
    stored = _stored_settings(seeded["settings_id"])
    assert stored.active_provider == "openai"
    assert crypto.decrypt_api_key(stored.api_key_anthropic) == DESKTOP_KEY
    assert stored.api_key_openai is None


def test_push_skips_api_key_backups(client: TestClient, seeded: dict[str, str]):
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": seeded["user_id"],
            "table": "api_key_backups",
            "since": FAR_FUTURE,
            "records": [
                {
                    "id": seeded["backup_id"],
                    "user_id": seeded["user_id"],
                    "provider": "anthropic",
                    "key": BROWSER_KEY,
                    "encrypted_key": BROWSER_KEY,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["accepted"] == []
    assert resp.json()["skipped"] == [seeded["backup_id"]]
    db = SessionLocal()
    try:
        backup = db.get(ApiKeyBackup, seeded["backup_id"])
        assert crypto.decrypt_api_key(backup.encrypted_key) == DESKTOP_KEY
    finally:
        db.close()


def test_conflict_bundle_carries_no_api_key(client: TestClient, seeded: dict[str, str]):
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": seeded["user_id"],
            "table": "user_settings",
            "since": LONG_AGO,
            "records": [_browser_settings_record(seeded)],
        },
    )
    assert resp.status_code == 200, resp.text
    conflicts = resp.json()["conflicts"]
    assert len(conflicts) == 1
    for side in ("local", "remote"):
        for field in EXCLUDED_USER_SETTINGS_FIELDS:
            assert field not in conflicts[0][side]
    assert conflicts[0]["local"]["active_provider"] == "anthropic"
    assert seeded["ciphertext"] not in resp.text
    assert BROWSER_KEY not in resp.text


@pytest.mark.parametrize("chosen", ["merged", "remote"])
def test_resolve_never_writes_a_key(client: TestClient, seeded: dict[str, str], chosen: str):
    resp = client.post(
        "/api/sync/resolve",
        json={
            "user_id": seeded["user_id"],
            "resolutions": [
                {
                    "table": "user_settings",
                    "id": seeded["settings_id"],
                    "chosen": chosen,
                    "merged_data": _browser_settings_record(seeded, active_provider="gemini"),
                },
                {
                    "table": "api_key_backups",
                    "id": seeded["backup_id"],
                    "chosen": chosen,
                    "merged_data": {"id": seeded["backup_id"], "encrypted_key": BROWSER_KEY},
                },
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["applied"] == [seeded["settings_id"]]
    assert resp.json()["skipped"] == [seeded["backup_id"]]
    stored = _stored_settings(seeded["settings_id"])
    assert stored.active_provider == "gemini"
    assert crypto.decrypt_api_key(stored.api_key_anthropic) == DESKTOP_KEY
    db = SessionLocal()
    try:
        backup = db.get(ApiKeyBackup, seeded["backup_id"])
        assert crypto.decrypt_api_key(backup.encrypted_key) == DESKTOP_KEY
    finally:
        db.close()
