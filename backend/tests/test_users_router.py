"""Phase 1C-B integration tests for /api/users.

Covers: POST 201 + payload echo, GET 200 + 404, PATCH 200 + 404 +
409-on-email-collision, payload validation (empty name + bad
email), and the partial-update semantics
(``exclude_unset`` — fields not in the body keep their stored
value).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.routers.users import router as users_router
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    return make_client(users_router)


# --- POST -------------------------------------------------------------------


def test_post_creates_user_201(client: TestClient):
    resp = client.post(
        "/api/users",
        json={"name": "Aster", "email": "aster@example.com", "language": "de"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Aster"
    assert body["email"] == "aster@example.com"
    assert body["language"] == "de"
    assert body["id"]
    assert body["created_at"]
    assert body["updated_at"]


def test_post_defaults_language_de(client: TestClient):
    resp = client.post("/api/users", json={"name": "NoEmail"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["language"] == "de"
    assert body["email"] is None


def test_post_rejects_empty_name_422(client: TestClient):
    resp = client.post("/api/users", json={"name": ""})
    assert resp.status_code == 422


def test_post_rejects_malformed_email_422(client: TestClient):
    resp = client.post("/api/users", json={"name": "x", "email": "not-an-email"})
    assert resp.status_code == 422


def test_post_duplicate_email_returns_409(client: TestClient):
    payload = {"name": "First", "email": "dup@example.com"}
    assert client.post("/api/users", json=payload).status_code == 201
    second = client.post("/api/users", json={"name": "Second", "email": "dup@example.com"})
    assert second.status_code == 409
    detail = second.json()["detail"]
    assert "dup@example.com" in detail


# --- GET -------------------------------------------------------------------


def test_get_returns_user(client: TestClient):
    create = client.post("/api/users", json={"name": "Sam", "email": "sam@example.com"})
    user_id = create.json()["id"]
    resp = client.get(f"/api/users/{user_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == user_id
    assert resp.json()["email"] == "sam@example.com"


def test_get_unknown_user_404(client: TestClient):
    resp = client.get("/api/users/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


# --- PATCH ------------------------------------------------------------------


def test_patch_updates_name_only(client: TestClient):
    create = client.post("/api/users", json={"name": "Original", "email": "patch@example.com"})
    user_id = create.json()["id"]
    resp = client.patch(f"/api/users/{user_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Renamed"
    # PATCH must not touch fields the client omitted.
    assert body["email"] == "patch@example.com"


def test_patch_clears_email_with_explicit_null(client: TestClient):
    create = client.post("/api/users", json={"name": "X", "email": "clear@example.com"})
    user_id = create.json()["id"]
    resp = client.patch(f"/api/users/{user_id}", json={"email": None})
    assert resp.status_code == 200
    assert resp.json()["email"] is None


def test_patch_unknown_user_404(client: TestClient):
    resp = client.patch("/api/users/missing-id", json={"name": "x"})
    assert resp.status_code == 404


def test_patch_to_existing_email_returns_409(client: TestClient):
    a = client.post("/api/users", json={"name": "A", "email": "a@example.com"})
    b = client.post("/api/users", json={"name": "B", "email": "b@example.com"})
    assert a.status_code == 201 and b.status_code == 201
    resp = client.patch(f"/api/users/{b.json()['id']}", json={"email": "a@example.com"})
    assert resp.status_code == 409


def test_patch_with_empty_body_is_noop_but_200(client: TestClient):
    """Sending ``{}`` is a valid PATCH: nothing changes, the row is
    returned as-is. Catches the regression where exclude_unset
    accidentally writes None to every column.
    """
    create = client.post("/api/users", json={"name": "Same", "email": "same@example.com"})
    before = create.json()
    resp = client.patch(f"/api/users/{before['id']}", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == before["name"]
    assert body["email"] == before["email"]
    assert body["language"] == before["language"]


def test_patch_validates_new_email(client: TestClient):
    create = client.post("/api/users", json={"name": "X", "email": "good@example.com"})
    resp = client.patch(f"/api/users/{create.json()['id']}", json={"email": "still-not-an-email"})
    assert resp.status_code == 422
