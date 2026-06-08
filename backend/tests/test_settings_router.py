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
from app.repositories.settings_repo import SqlAlchemySettingsRepository
from app.routers.settings import router as settings_router
from app.routers.users import router as users_router
from app.services import secrets_service
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


def test_get_or_create_settings_survives_concurrent_first_access(client: TestClient):
    """BL-23 regression pin: React 18 strict-mode double-effect or a
    parallel pair of ``GET /api/settings/{id}`` requests against a
    user with no UserSettings row used to bubble a UNIQUE constraint
    IntegrityError out as HTTP 500. Now the loser of the race
    rolls back and reads the winner's row.

    Simulate the race by having the loser race a pre-committed row
    that landed AFTER its own None-check: monkeypatch the service to
    insert a competing row between the check and the commit.
    """
    from app.models import User as UserModel
    from app.models import UserSettings as UserSettingsModel

    user_id = _make_user(client)

    db_loser = SessionLocal()
    try:
        user_in_loser = db_loser.get(UserModel, user_id)
        assert user_in_loser is not None
        # Loser's None-check passes.
        assert user_in_loser.settings is None

        # Race winner: a DIFFERENT session inserts and commits the
        # settings row for the same user. From db_loser's still-open
        # identity-map view, ``user.settings`` is cached at None even
        # though the row now exists in the DB.
        db_winner = SessionLocal()
        try:
            winner_row = UserSettingsModel(user_id=user_id)
            db_winner.add(winner_row)
            db_winner.commit()
            winner_id = winner_row.id
        finally:
            db_winner.close()

        # Now invoke the service on the loser session. The cached
        # ``user.settings is None`` will route it through the insert
        # branch; the commit must hit IntegrityError, recover, and
        # return the winner's row.
        result = settings_service.get_or_create_settings(
            SqlAlchemySettingsRepository(db_loser), user_id
        )
        assert result.id == winner_id
    finally:
        db_loser.close()

    rows = SessionLocal()
    try:
        count = rows.query(UserSettings).filter_by(user_id=user_id).count()
    finally:
        rows.close()
    assert count == 1


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
    """SECURITY: secrets.yaml must hold a Fernet ciphertext, not the
    user's plaintext key. Sentinel string makes it unambiguous."""
    import yaml

    user_id = _make_user(client)
    plaintext = "sk-anthropic-LEAKED-IF-YOU-SEE-THIS"
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": plaintext},
    )
    assert resp.status_code == 200
    # The raw secrets.yaml must NOT contain the plaintext anywhere; the
    # value lives encrypted under ai.anthropic.api_key_encrypted.
    raw = secrets_service.secrets_path().read_text(encoding="utf-8")
    assert plaintext not in raw
    block = yaml.safe_load(raw)["ai"]["anthropic"]
    assert block.get("api_key_encrypted")
    assert plaintext not in block["api_key_encrypted"]
    # And it round-trips back to the original plaintext.
    assert secrets_service.read_api_key("anthropic") == plaintext
    # The DB column is NOT used as the write target anymore.
    db = SessionLocal()
    try:
        row = db.query(UserSettings).filter_by(user_id=user_id).one()
        assert row.api_key_anthropic is None
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
    assert secrets_service.read_api_key("openai") == plaintext


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
    assert secrets_service.read_api_key("anthropic") == "ant-key"
    assert secrets_service.read_api_key("openai") == "oai-key"
    assert secrets_service.read_api_key("gemini") == "gem-key"


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
    assert secrets_service.read_api_key("anthropic") == "second"


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


# --- PATCH model_override_* (v0.4.0) ----------------------------------------


def test_get_settings_exposes_null_model_overrides_by_default(client: TestClient):
    user_id = _make_user(client)
    body = client.get(f"/api/settings/{user_id}").json()
    assert body["model_override_anthropic"] is None
    assert body["model_override_openai"] is None
    assert body["model_override_gemini"] is None


def test_patch_sets_anthropic_model_override(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "claude-sonnet-4-20250514"},
    )
    assert resp.status_code == 200
    assert resp.json()["model_override_anthropic"] == "claude-sonnet-4-20250514"


def test_patch_sets_overrides_for_all_three_providers(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={
            "model_override_anthropic": "claude-sonnet-4-20250514",
            "model_override_openai": "gpt-4o",
            "model_override_gemini": "gemini-2.5-pro",
        },
    )
    body = resp.json()
    assert body["model_override_anthropic"] == "claude-sonnet-4-20250514"
    assert body["model_override_openai"] == "gpt-4o"
    assert body["model_override_gemini"] == "gemini-2.5-pro"


def test_patch_empty_string_clears_override(client: TestClient):
    """Sending ``""`` resets the override to NULL — the convention
    for "go back to the default model"."""
    user_id = _make_user(client)
    client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "claude-sonnet-4-20250514"},
    )
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": ""},
    )
    assert resp.status_code == 200
    assert resp.json()["model_override_anthropic"] is None


def test_patch_whitespace_only_override_clears(client: TestClient):
    user_id = _make_user(client)
    client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "claude-sonnet-4-20250514"},
    )
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "   \n  "},
    )
    assert resp.status_code == 200
    assert resp.json()["model_override_anthropic"] is None


def test_patch_strips_whitespace_around_override(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "  claude-sonnet-4-20250514  "},
    )
    assert resp.status_code == 200
    assert resp.json()["model_override_anthropic"] == "claude-sonnet-4-20250514"


def test_patch_omitting_override_leaves_existing_value(client: TestClient):
    """A PATCH that doesn't mention an override field must NOT
    clear an existing override."""
    user_id = _make_user(client)
    client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_openai": "gpt-4o"},
    )
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"active_provider": "openai"},
    )
    body = resp.json()
    assert body["active_provider"] == "openai"
    assert body["model_override_openai"] == "gpt-4o"


def test_patch_rejects_oversized_override_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "x" * 201},
    )
    assert resp.status_code == 422


# --- GET /available-models (v1.11.0 / Phase 24A) ---------------------------


def test_available_models_no_key_returns_empty(client: TestClient):
    """Without an API key for the requested provider, the endpoint
    returns an empty list (no upstream call, no error)."""
    user_id = _make_user(client)
    resp = client.get(
        f"/api/settings/{user_id}/available-models",
        params={"provider": "anthropic"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_available_models_decrypts_key_and_returns_list(client, monkeypatch):
    import httpx

    from app.services import model_discovery

    model_discovery.clear_cache()

    user_id = _make_user(client)
    client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "sk-ant-fake-router-test"},
    )

    def fake_get(url, **kwargs):
        # Verify the router decrypted + passed our plaintext key.
        assert kwargs["headers"]["x-api-key"] == "sk-ant-fake-router-test"
        request = httpx.Request("GET", url)
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "claude-opus-4-20250514", "display_name": "Claude Opus 4"},
                ]
            },
            request=request,
        )

    monkeypatch.setattr(model_discovery.httpx, "get", fake_get)
    resp = client.get(
        f"/api/settings/{user_id}/available-models",
        params={"provider": "anthropic"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == "claude-opus-4-20250514"
    assert body[0]["name"] == "Claude Opus 4"
    assert body[0]["context_window"] == 200000
    model_discovery.clear_cache()


def test_available_models_provider_required_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.get(f"/api/settings/{user_id}/available-models")
    assert resp.status_code == 422


def test_available_models_invalid_provider_422(client: TestClient):
    user_id = _make_user(client)
    resp = client.get(
        f"/api/settings/{user_id}/available-models",
        params={"provider": "magic-llm"},
    )
    assert resp.status_code == 422
