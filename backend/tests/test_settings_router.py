"""Phase 1C-D integration tests for /api/settings/{user_id}.

The security-critical assertions are:

1. POST /api-key writes CIPHERTEXT to the DB, never plaintext.
2. The HTTP response body NEVER contains api_key_* fields. Only
   has_<provider>_key booleans + active_provider.
3. The full encrypt/decrypt round-trip via
   ``get_decrypted_api_key`` recovers the original plaintext.

Functional tests cover GET auto-create, PATCH across
UserSettings + User, idempotent DELETE, provider validation.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import UserSettings
from app.routers.settings import router as settings_router
from app.routers.users import router as users_router
from app.schemas import AIProvider
from app.services import settings as settings_service
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    return make_client(users_router, settings_router)


def _make_user(client: TestClient, language: str = "de") -> str:
    resp = client.post("/api/users", json={"name": "Aster", "language": language})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# --- GET --------------------------------------------------------------------


def test_get_settings_auto_creates_row(client: TestClient):
    user_id = _make_user(client)
    resp = client.get(f"/api/settings/{user_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == user_id
    # Defaults: anthropic + no keys.
    assert body["active_provider"] == "anthropic"
    assert body["has_anthropic_key"] is False
    assert body["has_openai_key"] is False
    assert body["has_gemini_key"] is False
    assert body["language"] == "de"


def test_get_settings_unknown_user_404(client: TestClient):
    resp = client.get("/api/settings/missing-user")
    assert resp.status_code == 404
    assert "missing-user" in resp.json()["detail"]


def test_get_settings_idempotent_does_not_duplicate_row(client: TestClient):
    user_id = _make_user(client)
    first = client.get(f"/api/settings/{user_id}").json()
    second = client.get(f"/api/settings/{user_id}").json()
    assert first["id"] == second["id"]


def test_get_settings_never_returns_api_key_columns(client: TestClient):
    """Defence-in-depth: even if the schema accidentally adds the
    column back, this test fails."""
    user_id = _make_user(client)
    body = client.get(f"/api/settings/{user_id}").json()
    for forbidden in ("api_key_anthropic", "api_key_openai", "api_key_gemini"):
        assert forbidden not in body


# --- PATCH ------------------------------------------------------------------


def test_patch_updates_active_provider(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(f"/api/settings/{user_id}", json={"active_provider": "openai"})
    assert resp.status_code == 200
    assert resp.json()["active_provider"] == "openai"


def test_patch_updates_language_across_tables(client: TestClient):
    user_id = _make_user(client, language="de")
    resp = client.patch(f"/api/settings/{user_id}", json={"language": "en"})
    assert resp.status_code == 200
    assert resp.json()["language"] == "en"
    # The User row itself must reflect the change too.
    user_resp = client.get(f"/api/users/{user_id}")
    assert user_resp.json()["language"] == "en"


def test_patch_both_at_once(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"active_provider": "gemini", "language": "fr"},
    )
    body = resp.json()
    assert body["active_provider"] == "gemini"
    assert body["language"] == "fr"


def test_patch_unknown_user_404(client: TestClient):
    resp = client.patch("/api/settings/does-not-exist", json={"active_provider": "openai"})
    assert resp.status_code == 404


def test_patch_rejects_unknown_provider_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(f"/api/settings/{user_id}", json={"active_provider": "magic-llm"})
    assert resp.status_code == 422


def test_patch_rejects_too_short_language_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(f"/api/settings/{user_id}", json={"language": "x"})
    assert resp.status_code == 422


def test_patch_with_empty_body_is_200_no_op(client: TestClient):
    user_id = _make_user(client)
    before = client.get(f"/api/settings/{user_id}").json()
    resp = client.patch(f"/api/settings/{user_id}", json={})
    assert resp.status_code == 200
    after = resp.json()
    assert after["active_provider"] == before["active_provider"]
    assert after["language"] == before["language"]


# --- POST api-key (encryption-critical) ------------------------------------


def test_post_api_key_stores_ciphertext_not_plaintext(client: TestClient):
    """SECURITY: the DB row must hold a Fernet ciphertext, not the
    user's plaintext key. Sentinel string makes the assertion
    unambiguous."""
    user_id = _make_user(client)
    plaintext = "sk-anthropic-LEAKED-IF-YOU-SEE-THIS"
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": plaintext},
    )
    assert resp.status_code == 200
    # Read the row directly. The api_key_anthropic column must be
    # non-empty and must NOT equal the plaintext.
    db = SessionLocal()
    try:
        row = db.query(UserSettings).filter_by(user_id=user_id).one()
        assert row.api_key_anthropic is not None
        assert row.api_key_anthropic != plaintext
        assert plaintext not in row.api_key_anthropic
    finally:
        db.close()


def test_post_api_key_response_never_contains_plaintext(client: TestClient):
    user_id = _make_user(client)
    plaintext = "sk-anthropic-PLAINTEXT-MUST-NOT-LEAK"
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": plaintext},
    )
    assert resp.status_code == 200
    body = resp.text  # raw JSON string
    assert plaintext not in body
    parsed = resp.json()
    for forbidden in ("api_key_anthropic", "api_key_openai", "api_key_gemini"):
        assert forbidden not in parsed
    assert parsed["has_anthropic_key"] is True


def test_post_api_key_round_trip_via_service(client: TestClient):
    """The decrypt path must recover the exact plaintext."""
    user_id = _make_user(client)
    plaintext = "sk-openai-roundtrip-12345"
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "openai", "key": plaintext},
    )
    assert resp.status_code == 200
    db = SessionLocal()
    try:
        recovered = settings_service.get_decrypted_api_key(db, user_id, AIProvider.OPENAI)
        assert recovered == plaintext
    finally:
        db.close()


def test_post_api_key_each_provider_writes_correct_column(client: TestClient):
    user_id = _make_user(client)
    for provider, sentinel in [
        ("anthropic", "ant-key"),
        ("openai", "oai-key"),
        ("gemini", "gem-key"),
    ]:
        client.post(
            f"/api/settings/{user_id}/api-key",
            json={"provider": provider, "key": sentinel},
        )
    body = client.get(f"/api/settings/{user_id}").json()
    assert body["has_anthropic_key"] is True
    assert body["has_openai_key"] is True
    assert body["has_gemini_key"] is True
    db = SessionLocal()
    try:
        recovered_a = settings_service.get_decrypted_api_key(db, user_id, AIProvider.ANTHROPIC)
        recovered_o = settings_service.get_decrypted_api_key(db, user_id, AIProvider.OPENAI)
        recovered_g = settings_service.get_decrypted_api_key(db, user_id, AIProvider.GEMINI)
        assert recovered_a == "ant-key"
        assert recovered_o == "oai-key"
        assert recovered_g == "gem-key"
    finally:
        db.close()


def test_post_api_key_unknown_user_404(client: TestClient):
    resp = client.post(
        "/api/settings/no-such-user/api-key",
        json={"provider": "anthropic", "key": "k"},
    )
    assert resp.status_code == 404


def test_post_api_key_rejects_unknown_provider_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "magic-llm", "key": "k"},
    )
    assert resp.status_code == 422


def test_post_api_key_rejects_empty_key_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": ""},
    )
    assert resp.status_code == 422


def test_post_api_key_replaces_existing_value(client: TestClient):
    """Two POSTs for the same provider replace, not append. The
    second plaintext is what decrypts on the next read."""
    user_id = _make_user(client)
    client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "first"},
    )
    client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "second"},
    )
    db = SessionLocal()
    try:
        assert settings_service.get_decrypted_api_key(db, user_id, AIProvider.ANTHROPIC) == "second"
    finally:
        db.close()


# --- DELETE api-key --------------------------------------------------------


def test_delete_api_key_clears_column(client: TestClient):
    user_id = _make_user(client)
    client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "to-delete"},
    )
    resp = client.delete(f"/api/settings/{user_id}/api-key/anthropic")
    assert resp.status_code == 200
    assert resp.json()["has_anthropic_key"] is False
    db = SessionLocal()
    try:
        row = db.query(UserSettings).filter_by(user_id=user_id).one()
        assert row.api_key_anthropic is None
    finally:
        db.close()


def test_delete_api_key_idempotent_when_already_unset(client: TestClient):
    user_id = _make_user(client)
    # No POST first; the column starts as NULL.
    resp = client.delete(f"/api/settings/{user_id}/api-key/openai")
    assert resp.status_code == 200
    assert resp.json()["has_openai_key"] is False


def test_delete_api_key_unknown_user_404(client: TestClient):
    resp = client.delete("/api/settings/no-such/api-key/anthropic")
    assert resp.status_code == 404


def test_delete_api_key_unknown_provider_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.delete(f"/api/settings/{user_id}/api-key/magic-llm")
    assert resp.status_code == 422


def test_delete_api_key_does_not_touch_other_providers(client: TestClient):
    user_id = _make_user(client)
    client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "stays"},
    )
    client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "openai", "key": "also-stays"},
    )
    resp = client.delete(f"/api/settings/{user_id}/api-key/anthropic")
    body = resp.json()
    assert body["has_anthropic_key"] is False
    assert body["has_openai_key"] is True
    assert body["has_gemini_key"] is False
