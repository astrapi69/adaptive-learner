"""Tests for ``app.services.identity_service`` (Phase 41A).

Two layers:

- Unit tests on the service surface (save/load round-trip, file
  permissions, malformed-file handling, clear_identity).
- Integration tests through TestClient: POST /api/users writes
  identity.yaml; PATCH /api/users updates language; POST projects
  sets active_project_id; PATCH /api/projects with active=True
  refreshes active_project_id; GET /api/identity returns the
  payload (or 404 when no file); DELETE /api/identity removes it.

Per-test isolation: every test gets its own ``tmp_path``-backed
``ADAPTIVE_LEARNER_CONFIG_DIR`` via monkeypatch so writes are
scoped, even though the conftest already sets a process-level
config dir for safety.
"""

from __future__ import annotations

import stat
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import identity_service


@pytest.fixture(autouse=True)
def _isolate_config_dir(monkeypatch, tmp_path):
    """Per-test config dir so write order between tests does not matter."""
    monkeypatch.setenv("ADAPTIVE_LEARNER_CONFIG_DIR", str(tmp_path))
    yield tmp_path


# --- Unit: service surface --------------------------------------------------


def test_load_returns_none_when_file_missing(_isolate_config_dir):
    assert identity_service.load_identity() is None


def test_update_then_load_roundtrip(_isolate_config_dir):
    identity_service.update_identity(
        user_id="u-1", project_id="p-1", language="de"
    )
    data = identity_service.load_identity()
    assert data is not None
    assert data["user_id"] == "u-1"
    assert data["active_project_id"] == "p-1"
    assert data["language"] == "de"
    assert "last_seen" in data


def test_update_preserves_existing_fields_when_partial(_isolate_config_dir):
    """A language-only update must keep active_project_id intact."""
    identity_service.update_identity(
        user_id="u-1", project_id="p-1", language="de"
    )
    identity_service.update_identity(user_id="u-1", language="en")
    data = identity_service.load_identity()
    assert data["active_project_id"] == "p-1"
    assert data["language"] == "en"


def test_update_refreshes_last_seen(_isolate_config_dir):
    identity_service.update_identity(user_id="u-1", language="de")
    first = identity_service.load_identity()["last_seen"]
    # bump to second resolution — last_seen is ISO-8601 with microseconds
    identity_service.update_identity(user_id="u-1", language="de")
    second = identity_service.load_identity()["last_seen"]
    assert second >= first


def test_clear_identity_removes_file(_isolate_config_dir):
    identity_service.update_identity(user_id="u-1", language="de")
    assert identity_service.get_identity_path().is_file()
    identity_service.clear_identity()
    assert not identity_service.get_identity_path().is_file()
    assert identity_service.load_identity() is None


def test_clear_identity_is_idempotent(_isolate_config_dir):
    identity_service.clear_identity()  # no-op
    identity_service.clear_identity()  # still no-op


@pytest.mark.skipif(sys.platform.startswith("win"), reason="POSIX chmod")
def test_file_permissions_are_0o600(_isolate_config_dir):
    identity_service.update_identity(user_id="u-1", language="de")
    path = identity_service.get_identity_path()
    mode = stat.S_IMODE(path.stat().st_mode)
    assert mode == 0o600


def test_load_returns_none_on_malformed_yaml(_isolate_config_dir):
    path = identity_service.get_identity_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("this is: : : not valid yaml\n", encoding="utf-8")
    assert identity_service.load_identity() is None


def test_load_returns_none_when_top_level_is_not_dict(_isolate_config_dir):
    path = identity_service.get_identity_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("- one\n- two\n", encoding="utf-8")
    assert identity_service.load_identity() is None


def test_load_returns_none_when_user_id_missing(_isolate_config_dir):
    path = identity_service.get_identity_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("language: de\n", encoding="utf-8")
    assert identity_service.load_identity() is None


def test_get_identity_path_uses_config_dir(_isolate_config_dir):
    path = identity_service.get_identity_path()
    assert path == Path(_isolate_config_dir) / "identity.yaml"


# --- Integration: endpoint + hook surface -----------------------------------


@pytest.fixture
def client() -> TestClient:
    """Fresh TestClient per test (triggers lifespan + DB init)."""
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_create_user_writes_identity(client, _isolate_config_dir):
    resp = client.post(
        "/api/users",
        json={"name": "Asterios", "language": "de"},
    )
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    data = identity_service.load_identity()
    assert data is not None
    assert data["user_id"] == user_id
    assert data["language"] == "de"
    # No project yet at user-creation time.
    assert data.get("active_project_id") is None


def test_patch_user_language_refreshes_identity(client, _isolate_config_dir):
    resp = client.post("/api/users", json={"name": "X", "language": "de"})
    user_id = resp.json()["id"]
    # Switch language
    resp = client.patch(f"/api/users/{user_id}", json={"language": "en"})
    assert resp.status_code == 200
    data = identity_service.load_identity()
    assert data["language"] == "en"


def test_create_project_sets_active_project_id(client, _isolate_config_dir):
    resp = client.post("/api/users", json={"name": "X", "language": "de"})
    user_id = resp.json()["id"]
    resp = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Spanish",
            "goal": "fluency",
            "timeframe": "3 months",
            "daily_minutes": 30,
        },
    )
    assert resp.status_code == 201
    project_id = resp.json()["id"]
    data = identity_service.load_identity()
    assert data["active_project_id"] == project_id


def test_patch_project_active_true_refreshes_identity(
    client, _isolate_config_dir
):
    """Switching projects via active=True must update identity.yaml."""
    resp = client.post("/api/users", json={"name": "X", "language": "de"})
    user_id = resp.json()["id"]
    # Two projects so we can simulate switch
    r1 = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "A",
            "goal": "g",
            "timeframe": "1 month",
            "daily_minutes": 10,
        },
    )
    p1_id = r1.json()["id"]
    r2 = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "B",
            "goal": "g",
            "timeframe": "1 month",
            "daily_minutes": 10,
            "active": False,
        },
    )
    p2_id = r2.json()["id"]
    # After r2's create-hook, active_project_id is whichever was created last.
    # Flip p1 active=true — identity.yaml should follow.
    client.patch(f"/api/projects/{p1_id}", json={"active": True})
    data = identity_service.load_identity()
    assert data["active_project_id"] == p1_id
    # Sanity: a non-active PATCH doesn't move it.
    client.patch(f"/api/projects/{p2_id}", json={"topic": "B-renamed"})
    data = identity_service.load_identity()
    assert data["active_project_id"] == p1_id


def test_get_identity_returns_404_when_missing(client, _isolate_config_dir):
    resp = client.get("/api/identity")
    assert resp.status_code == 404


def test_get_identity_returns_payload_when_present(client, _isolate_config_dir):
    identity_service.update_identity(
        user_id="u-1", project_id="p-1", language="de"
    )
    resp = client.get("/api/identity")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == "u-1"
    assert body["active_project_id"] == "p-1"
    assert body["language"] == "de"
    assert body["last_seen"]


def test_delete_identity_removes_file(client, _isolate_config_dir):
    identity_service.update_identity(user_id="u-1", language="de")
    resp = client.delete("/api/identity")
    assert resp.status_code == 204
    assert identity_service.load_identity() is None
    # idempotent
    resp = client.delete("/api/identity")
    assert resp.status_code == 204
