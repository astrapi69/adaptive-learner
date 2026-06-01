"""Phase 1C-E end-to-end smoke against the REAL app.

The per-chunk router tests (test_users_router / test_projects_router /
test_settings_router) mount each router on a stripped-down FastAPI
instance via ``router_test_client.make_client``. That keeps the
chunk tests fast but skips the production wiring — main.py's
lifespan, the layered config, the global exception handler
registration, the CORS middleware.

This file boots the actual ``app.main.app`` once and walks
the happy path the frontend will follow: create user -> get
settings -> set api key -> create project -> list projects ->
patch project -> patch settings. If any step regresses against
the wiring in main.py (route prefix missing, lifespan crash,
crypto-startup-validation failure), this fails loudly.

The crypto.validate_at_startup() call from the lifespan is
exercised implicitly: the conftest seeds
``ADAPTIVE_LEARNER_SECRET_KEY`` before any app.* import, so the
lifespan starts cleanly.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    # ``with TestClient(app)`` fires the lifespan startup +
    # shutdown around each test (per starlette docs).
    with TestClient(app) as c:
        yield c


def test_lifespan_starts_without_crypto_error(client: TestClient):
    """Sanity: the lifespan would have raised CryptoConfigurationError
    if ADAPTIVE_LEARNER_SECRET_KEY were missing. Getting this far
    means the conftest seeded the key + the lifespan wired
    validate_at_startup correctly."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


def test_infrastructure_endpoints_still_mounted(client: TestClient):
    """1A endpoints must coexist with the 1C router quartet."""
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/i18n/en").status_code == 200
    assert client.get("/api/plugins/manifests").status_code == 200
    assert client.get("/api/plugins/health").status_code == 200
    assert client.get("/api/plugins/errors").status_code == 200


def test_security_headers_on_api_response(client: TestClient):
    """Phase 61 audit P3: every response carries defense-in-depth
    security headers, and a normal API (JSON) response gets the strict
    deny-everything CSP."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Referrer-Policy"] == "no-referrer"
    csp = resp.headers["Content-Security-Policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


def test_security_headers_present_on_error_response(client: TestClient):
    """The middleware wraps the global exception handler too: a 404
    still carries the headers (a bare error response is the easiest
    place to forget them)."""
    resp = client.get("/api/plugins/inspect/nonexistent-plugin")
    assert resp.status_code == 404
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in resp.headers["Content-Security-Policy"]


def test_openapi_schema_gets_relaxed_csp(client: TestClient):
    """The OpenAPI / Swagger paths serve real HTML+JS from a CDN, so
    they must NOT get the strict 'none' CSP (which would blank Swagger
    UI). They get the CDN-aware policy instead."""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    csp = resp.headers["Content-Security-Policy"]
    assert "cdn.jsdelivr.net" in csp
    assert "default-src 'none'" not in csp


def test_plugin_inspect_returns_lifecycle_metadata(client: TestClient):
    """PLUGINFORGE-LIFECYCLE-UI-01: ``/api/plugins/inspect/{name}``
    surfaces the v0.9.0 lifecycle visibility (activated_at, source,
    etc.) for the Settings UI."""
    resp = client.get("/api/plugins/inspect/assessment")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "assessment"
    # ``version`` is the plugin's own pyproject version; just
    # require a non-empty string. ``target_application`` was set
    # to "adaptive_learner" on every shipped plugin since v1.7.0.
    assert isinstance(body["version"], str) and body["version"]
    assert body["target_application"] == "adaptive_learner"
    state = body["state"]
    assert state["activated"] is True
    # activated_at is set by pluginforge v0.9.0+ on every
    # successful activation. ISO-8601 string, not None.
    assert isinstance(state["activated_at"], str)
    assert "T" in state["activated_at"]
    assert state["source"] == "entry_point"
    assert state["filter_reason"] is None
    assert state["load_error"] is None


def test_plugin_inspect_unknown_name_404(client: TestClient):
    resp = client.get("/api/plugins/inspect/nonexistent-plugin")
    assert resp.status_code == 404
    assert "nonexistent-plugin" in resp.json()["detail"]


def test_full_happy_path(client: TestClient):
    # 1. Create the user.
    resp = client.post(
        "/api/users",
        json={"name": "Aster", "email": "aster@example.com", "language": "de"},
    )
    assert resp.status_code == 201, resp.text
    user_id = resp.json()["id"]

    # 2. GET settings auto-creates the row.
    resp = client.get(f"/api/settings/{user_id}")
    assert resp.status_code == 200
    settings = resp.json()
    assert settings["active_provider"] == "anthropic"
    assert settings["language"] == "de"
    assert settings["has_anthropic_key"] is False

    # 3. POST an encrypted API key.
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "sk-pretend-1234567890"},
    )
    assert resp.status_code == 200
    assert resp.json()["has_anthropic_key"] is True
    # Plaintext never appears in any response body.
    assert "sk-pretend-1234567890" not in resp.text

    # 4. Create a learning project.
    resp = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Adaptive learning",
            "goal": "Ship the MVP",
            "timeframe": "4 weeks",
            "daily_minutes": 45,
        },
    )
    assert resp.status_code == 201, resp.text
    project_id = resp.json()["id"]
    assert resp.json()["user_id"] == user_id

    # 5. List projects under the user.
    resp = client.get(f"/api/users/{user_id}/projects")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == project_id

    # 6. PATCH the project.
    resp = client.patch(f"/api/projects/{project_id}", json={"daily_minutes": 60})
    assert resp.status_code == 200
    assert resp.json()["daily_minutes"] == 60

    # 7. PATCH the settings (across UserSettings + User).
    resp = client.patch(
        f"/api/settings/{user_id}",
        json={"active_provider": "openai", "language": "en"},
    )
    assert resp.status_code == 200
    assert resp.json()["active_provider"] == "openai"
    assert resp.json()["language"] == "en"
    # Cross-table update visible on /api/users too.
    assert client.get(f"/api/users/{user_id}").json()["language"] == "en"

    # 8. DELETE the API key.
    resp = client.delete(f"/api/settings/{user_id}/api-key/anthropic")
    assert resp.status_code == 200
    assert resp.json()["has_anthropic_key"] is False


def test_global_exception_handler_returns_typed_404(client: TestClient):
    """NotFoundError raised inside a service must map to a 404
    JSON response via the handler registered in app.main."""
    resp = client.get("/api/users/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]
