"""Tests for ``app.services.reset_service`` + ``/api/reset`` (Phase 41F).

Two layers:

- Unit on the service: table truncation count + identity.yaml +
  secrets-yaml ai-block scrubbing with secret_key preservation.
- Integration via TestClient: confirmation-token gate, success
  payload, no surviving DB rows.

Per-test isolation: every test gets its own ``tmp_path``-backed
``ADAPTIVE_LEARNER_CONFIG_DIR`` so identity.yaml + secrets.yaml
writes are scoped. The DB is the conftest's in-memory SQLite,
so truncation is harmless.
"""

from __future__ import annotations

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal
from app.repositories.reset_repo import SqlAlchemyResetRepository
from app.services import identity_service, reset_service


@pytest.fixture(autouse=True)
def _isolate_config_dir(monkeypatch, tmp_path):
    """Per-test config dir so secrets.yaml + identity.yaml are scoped."""
    monkeypatch.setenv("ADAPTIVE_LEARNER_CONFIG_DIR", str(tmp_path))
    yield tmp_path


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Unit: service surface --------------------------------------------------


def test_confirmation_token_constant_is_literal_RESET():
    """If this constant changes, the frontend's typed-confirm UX
    breaks silently. Pin the literal."""
    assert reset_service.CONFIRMATION_TOKEN == "RESET"


def test_reset_all_truncates_every_table(client, db_session):
    """End-to-end: create a user via the API, then reset, then verify
    the users table is empty (proving truncation actually fired)."""
    resp = client.post("/api/users", json={"name": "X", "language": "de"})
    assert resp.status_code == 201
    user_id = resp.json()["id"]
    # Confirm row exists.
    resp = client.get(f"/api/users/{user_id}")
    assert resp.status_code == 200
    # Reset.
    count = reset_service.reset_all(SqlAlchemyResetRepository(db_session))
    assert count > 0  # every model contributes a table
    # The user should be gone.
    resp = client.get(f"/api/users/{user_id}")
    assert resp.status_code == 404


def test_reset_returns_count_matching_metadata_tables(db_session):
    count = reset_service.reset_all(SqlAlchemyResetRepository(db_session))
    assert count == len(Base.metadata.sorted_tables)


def test_reset_removes_identity_yaml(_isolate_config_dir, db_session):
    identity_service.update_identity(user_id="u-1", language="de")
    assert identity_service.get_identity_path().is_file()
    reset_service.reset_all(SqlAlchemyResetRepository(db_session))
    assert not identity_service.get_identity_path().is_file()


def test_reset_scrubs_ai_block_but_preserves_secret_key(_isolate_config_dir, db_session):
    """secrets.yaml's secret_key MUST survive a reset (deleting the
    Fernet key would make any surviving encrypted ciphertexts
    unreadable; the surviving backup-restore path depends on it)."""
    path = reset_service.secrets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(
            {
                "secret_key": "PRESERVE-ME-FERNET",
                "ai": {
                    "anthropic": {"api_key": "sk-anth-xxx"},
                    "openai": {"api_key": "sk-oai-yyy"},
                },
            }
        ),
        encoding="utf-8",
    )
    reset_service.reset_all(SqlAlchemyResetRepository(db_session))
    assert path.is_file(), "secrets.yaml must survive when secret_key present"
    survivors = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert survivors == {"secret_key": "PRESERVE-ME-FERNET"}, (
        "ai.* block must be scrubbed; secret_key must be preserved"
    )


def test_reset_removes_secrets_file_when_only_ai_block_present(_isolate_config_dir, db_session):
    """When secrets.yaml has only ``ai.*`` and no secret_key, the
    file is removed entirely rather than left as an empty document."""
    path = reset_service.secrets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump({"ai": {"anthropic": {"api_key": "sk-x"}}}),
        encoding="utf-8",
    )
    reset_service.reset_all(SqlAlchemyResetRepository(db_session))
    assert not path.is_file()


def test_reset_is_no_op_on_missing_secrets_file(_isolate_config_dir, db_session):
    """No secrets.yaml = no scrub work; the rest of the reset still
    runs (truncation + identity removal)."""
    path = reset_service.secrets_path()
    assert not path.is_file()
    reset_service.reset_all(SqlAlchemyResetRepository(db_session))  # must not raise


# --- Integration: endpoint + confirmation gate ------------------------------


def test_post_reset_rejects_wrong_confirmation(client):
    resp = client.post("/api/reset", json={"confirmation": "reset"})
    assert resp.status_code == 400
    assert "mismatch" in resp.json()["detail"].lower()


def test_post_reset_rejects_partial_token(client):
    resp = client.post("/api/reset", json={"confirmation": "RESE"})
    assert resp.status_code == 400


def test_post_reset_rejects_empty_confirmation(client):
    resp = client.post("/api/reset", json={"confirmation": ""})
    assert resp.status_code == 400


def test_post_reset_rejects_extra_whitespace(client):
    resp = client.post("/api/reset", json={"confirmation": "RESET "})
    assert resp.status_code == 400


def test_post_reset_missing_confirmation_field_is_422(client):
    """Pydantic catches the missing field before the equality check."""
    resp = client.post("/api/reset", json={})
    assert resp.status_code == 422


def test_post_reset_accepts_exact_RESET_token(client):
    """Smoke: the endpoint actually completes when the token matches."""
    # Seed a user so the truncation has visible effect.
    client.post("/api/users", json={"name": "X", "language": "de"})
    resp = client.post("/api/reset", json={"confirmation": "RESET"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["reset"] is True
    assert body["tables_cleared"] > 0
    # Idempotent: a second reset returns the same shape.
    resp = client.post("/api/reset", json={"confirmation": "RESET"})
    assert resp.status_code == 200


def test_post_reset_does_not_call_service_on_wrong_token(client, monkeypatch):
    """Pin that the equality gate runs BEFORE any side-effect."""
    called = {"n": 0}

    def fake_reset_all(repo) -> int:
        called["n"] += 1
        return 0

    monkeypatch.setattr(reset_service, "reset_all", fake_reset_all)
    resp = client.post("/api/reset", json={"confirmation": "rEsEt"})
    assert resp.status_code == 400
    assert called["n"] == 0
