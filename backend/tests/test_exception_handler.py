"""Tests for the global exception handler (Phase 37 C1).

Pins the DEBUG-gated stacktrace inclusion for 5xx domain errors.
A 4xx domain error MUST stay clean (no stacktrace / endpoint /
method) so toasts surface a clean detail string; a 5xx domain
error MUST include those three fields in DEBUG mode so the
frontend error-report dialog can pre-fill a GitHub issue body.
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.exceptions import (
    ExternalServiceError,
    NotFoundError,
    ValidationError,
)
from app.main import app


def _hit_error_via_dependency(
    monkeypatch, route: str, exc: Exception
) -> TestClient.__call__:
    """Use FastAPI's dependency-override hook to force the given
    exception to be raised before any service code runs. This
    bypasses the need for a real DB / model state and isolates
    the handler under test.
    """
    from app.database import get_db

    def _raise_dep():
        raise exc

    app.dependency_overrides[get_db] = _raise_dep
    try:
        with TestClient(app) as client:
            return client.get(route)
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_4xx_domain_error_returns_only_detail(monkeypatch):
    """A 404 NotFoundError must not carry a stacktrace even in
    DEBUG mode — 4xx isn't a bug and the dialog has nothing to
    pre-fill."""
    resp = _hit_error_via_dependency(
        monkeypatch,
        "/api/users/some-id",
        NotFoundError("nothing here"),
    )
    assert resp.status_code == 404
    body = resp.json()
    assert body["detail"] == "nothing here"
    assert "stacktrace" not in body
    assert "endpoint" not in body
    assert "method" not in body


def test_5xx_domain_error_includes_stacktrace_in_debug(monkeypatch):
    """A 502 ExternalServiceError in DEBUG mode must carry the
    stacktrace + endpoint + method so the frontend
    error-report dialog can pre-fill the GitHub issue body."""
    resp = _hit_error_via_dependency(
        monkeypatch,
        "/api/users/whatever",
        ExternalServiceError("Anthropic", "timeout"),
    )
    assert resp.status_code == 502
    body = resp.json()
    assert "Anthropic" in body["detail"]
    # DEBUG defaults to true in tests; the handler must emit
    # all three fields.
    assert isinstance(body.get("stacktrace"), str)
    assert "ExternalServiceError" in body["stacktrace"]
    assert body.get("endpoint") == "/api/users/whatever"
    assert body.get("method") == "GET"


def test_400_validation_error_stays_clean(monkeypatch):
    """ValidationError -> 400, no debug fields."""
    resp = _hit_error_via_dependency(
        monkeypatch,
        "/api/users/test",
        ValidationError("bad input"),
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["detail"] == "bad input"
    assert "stacktrace" not in body


def test_extra_field_merges_into_response_body(monkeypatch):
    """Phase 36 — AdaptiveLearnerError.extra still merges into the
    JSON body alongside detail (not regressed by the C1 change)."""
    from app.exceptions import ConflictError

    resp = _hit_error_via_dependency(
        monkeypatch,
        "/api/users/test",
        ConflictError("dup", extra={"existing_id": "abc-123"}),
    )
    assert resp.status_code == 409
    body = resp.json()
    assert body["detail"] == "dup"
    assert body.get("existing_id") == "abc-123"


def test_stacktrace_is_serializable_json(monkeypatch):
    """Regression pin: the stacktrace string must survive JSON
    serialisation cleanly (no non-ASCII control chars that break
    JSON parsers on the consumer side)."""
    resp = _hit_error_via_dependency(
        monkeypatch,
        "/api/users/x",
        ExternalServiceError("provider", "boom"),
    )
    raw = resp.content.decode("utf-8")
    # Round-trip parse + re-serialize must produce equivalent body.
    parsed = json.loads(raw)
    re_dumped = json.dumps(parsed)
    assert json.loads(re_dumped) == parsed
