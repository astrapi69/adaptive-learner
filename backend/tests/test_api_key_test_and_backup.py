"""Phase 65 — API-key test endpoint + rollback-backup tests.

Covers the live-test classifier (mocked httpx, no real network), the
``POST /test-api-key`` route, and the backup/get/restore service +
routes (encrypt-at-rest + single-row-per-provider + restore writes the
key back through the secrets.yaml path).
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.routers.settings import router as settings_router
from app.routers.users import router as users_router
from app.schemas import AIProvider
from app.services import api_key_test
from app.services import settings as settings_service
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    return make_client(users_router, settings_router)


def _make_user(client: TestClient) -> str:
    resp = client.post("/api/users", json={"name": "Aster", "language": "de"})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class _FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


# --- classifier -------------------------------------------------------------


def test_classify_maps_status_codes():
    assert api_key_test._classify(200).kind == "ok"
    assert api_key_test._classify(201).kind == "ok"
    assert api_key_test._classify(401).kind == "invalid"
    assert api_key_test._classify(403).kind == "invalid"
    assert api_key_test._classify(429).kind == "rate_limit"
    assert api_key_test._classify(500).kind == "error"


def test_test_api_key_no_key_short_circuits():
    result = api_key_test.test_api_key(AIProvider.ANTHROPIC, "")
    assert result.kind == "no_key"
    assert result.success is False


def test_test_api_key_success(monkeypatch):
    monkeypatch.setattr(
        api_key_test.httpx, "post", lambda *a, **k: _FakeResponse(200)
    )
    result = api_key_test.test_api_key(AIProvider.OPENAI, "sk-whatever")
    assert result.success is True
    assert result.kind == "ok"


def test_test_api_key_invalid(monkeypatch):
    monkeypatch.setattr(
        api_key_test.httpx, "post", lambda *a, **k: _FakeResponse(401)
    )
    result = api_key_test.test_api_key(AIProvider.ANTHROPIC, "sk-ant-bad")
    assert result.success is False
    assert result.kind == "invalid"


def test_test_api_key_network_failure(monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(api_key_test.httpx, "post", _boom)
    result = api_key_test.test_api_key(AIProvider.GEMINI, "AIxxxxxxxxx")
    assert result.success is False
    assert result.kind == "network"


# --- endpoint ---------------------------------------------------------------


def test_test_api_key_endpoint_returns_classified_result(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.api_key_test.httpx.post",
        lambda *a, **k: _FakeResponse(401),
    )
    user_id = _make_user(client)
    resp = client.post(
        f"/api/settings/{user_id}/test-api-key",
        json={"provider": "anthropic", "key": "sk-ant-whatever"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"success": False, "kind": "invalid"}


# --- backup / restore -------------------------------------------------------


def test_backup_roundtrip_encrypts_and_keeps_single_row(client):
    from app.database import SessionLocal
    from app.models import ApiKeyBackup

    user_id = _make_user(client)
    db = SessionLocal()
    try:
        settings_service.backup_api_key(
            db, user_id, AIProvider.ANTHROPIC, "sk-ant-secret-A"
        )
        backup = settings_service.get_api_key_backup(
            db, user_id, AIProvider.ANTHROPIC
        )
        assert backup is not None
        # Stored ciphertext, not plaintext.
        assert backup.encrypted_key != "sk-ant-secret-A"
        # Overwriting keeps exactly one row per provider.
        settings_service.backup_api_key(
            db, user_id, AIProvider.ANTHROPIC, "sk-ant-secret-B"
        )
        rows = (
            db.query(ApiKeyBackup)
            .filter(
                ApiKeyBackup.user_id == user_id,
                ApiKeyBackup.provider == "anthropic",
            )
            .count()
        )
        assert rows == 1
    finally:
        db.close()


def test_backup_info_endpoint(client):
    user_id = _make_user(client)
    # No backup yet.
    resp = client.get(f"/api/settings/{user_id}/api-key-backup/anthropic")
    assert resp.status_code == 200
    assert resp.json()["has"] is False
    # Create one, then it reports present.
    resp = client.post(
        f"/api/settings/{user_id}/api-key-backup",
        json={"provider": "anthropic", "key": "sk-ant-secret"},
    )
    assert resp.status_code == 200, resp.text
    resp = client.get(f"/api/settings/{user_id}/api-key-backup/anthropic")
    assert resp.json()["has"] is True
    assert resp.json()["tested_at"] is not None


def test_restore_without_backup_is_404(client):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/settings/{user_id}/api-key-backup/anthropic/restore"
    )
    assert resp.status_code == 404


def test_restore_writes_the_key_back(client, monkeypatch):
    written: dict[str, str] = {}
    monkeypatch.setattr(
        settings_service.secrets_service,
        "write_api_key",
        lambda provider, key: written.update({provider: key}),
    )
    user_id = _make_user(client)
    client.post(
        f"/api/settings/{user_id}/api-key-backup",
        json={"provider": "openai", "key": "sk-openai-secret-key"},
    )
    resp = client.post(
        f"/api/settings/{user_id}/api-key-backup/openai/restore"
    )
    assert resp.status_code == 200, resp.text
    # Restore decrypted the backup and wrote it back via secrets.yaml.
    assert written.get("openai") == "sk-openai-secret-key"
