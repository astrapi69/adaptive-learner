"""Phase 1C-C integration tests for projects.

Covers POST + list + GET + PATCH across the two prefixes:
  /api/users/{user_id}/projects   (create + list)
  /api/projects/{id}              (get + patch)

Plus the cross-boundary edge cases: list under an unknown user is
404 (not empty), POST that omits user_id from the path is 404, the
list ordering is newest-first, partial PATCH preserves untouched
fields.
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.routers.projects import projects_router, users_projects_router
from app.routers.users import router as users_router
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    """Both router pieces + the users router (so tests can create the
    parent user via API rather than hand-rolling DB inserts)."""
    return make_client(users_router, users_projects_router, projects_router)


def _make_user(client: TestClient, name: str = "Aster") -> str:
    resp = client.post("/api/users", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _project_body() -> dict:
    return {
        "topic": "Adaptive learning",
        "goal": "Ship the MVP",
        "timeframe": "4 weeks",
        "daily_minutes": 45,
        "current_problem": "Lose focus after 20 minutes.",
    }


# --- POST -------------------------------------------------------------------


def test_post_creates_project_201(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["topic"] == "Adaptive learning"
    assert body["daily_minutes"] == 45
    assert body["active"] is True
    assert body["id"]


def test_post_under_unknown_user_returns_404(client: TestClient):
    resp = client.post("/api/users/does-not-exist/projects", json=_project_body())
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


def test_post_body_user_id_is_ignored(client: TestClient):
    """LearningProjectCreateBody has no user_id field; even if a
    client wedges one in, Pydantic drops it on parse (extra=ignore
    default) and the project ends up owned by the path user.
    """
    owner = _make_user(client, "Owner")
    attacker = _make_user(client, "Attacker")
    body = {**_project_body(), "user_id": attacker}
    resp = client.post(f"/api/users/{owner}/projects", json=body)
    assert resp.status_code == 201
    assert resp.json()["user_id"] == owner


def test_post_rejects_zero_daily_minutes_422(client: TestClient):
    user_id = _make_user(client)
    bad = {**_project_body(), "daily_minutes": 0}
    resp = client.post(f"/api/users/{user_id}/projects", json=bad)
    assert resp.status_code == 422


def test_post_defaults_active_true(client: TestClient):
    user_id = _make_user(client)
    body = _project_body()
    body.pop("current_problem", None)
    resp = client.post(f"/api/users/{user_id}/projects", json=body)
    assert resp.status_code == 201
    assert resp.json()["active"] is True
    assert resp.json()["current_problem"] is None


# --- GET (list) -------------------------------------------------------------


def test_list_empty_for_user_with_no_projects(client: TestClient):
    user_id = _make_user(client)
    resp = client.get(f"/api/users/{user_id}/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_returns_newest_first(client: TestClient):
    user_id = _make_user(client)
    first = client.post(
        f"/api/users/{user_id}/projects", json={**_project_body(), "topic": "First"}
    ).json()
    # Force a perceptible timestamp gap so created_at ordering is
    # deterministic across SQLite resolution.
    time.sleep(0.01)
    second = client.post(
        f"/api/users/{user_id}/projects", json={**_project_body(), "topic": "Second"}
    ).json()
    resp = client.get(f"/api/users/{user_id}/projects")
    assert resp.status_code == 200
    body = resp.json()
    assert [p["topic"] for p in body] == ["Second", "First"]
    assert {p["id"] for p in body} == {first["id"], second["id"]}


def test_list_under_unknown_user_returns_404(client: TestClient):
    resp = client.get("/api/users/does-not-exist/projects")
    assert resp.status_code == 404


def test_list_does_not_leak_other_users_projects(client: TestClient):
    me = _make_user(client, "Me")
    other = _make_user(client, "Other")
    client.post(f"/api/users/{me}/projects", json=_project_body())
    client.post(f"/api/users/{other}/projects", json=_project_body())
    resp = client.get(f"/api/users/{me}/projects")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["user_id"] == me


# --- GET (single) -----------------------------------------------------------


def test_get_project(client: TestClient):
    user_id = _make_user(client)
    create = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    project_id = create.json()["id"]
    resp = client.get(f"/api/projects/{project_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == project_id


def test_get_unknown_project_404(client: TestClient):
    resp = client.get("/api/projects/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


# --- PATCH ------------------------------------------------------------------


def test_patch_updates_single_field(client: TestClient):
    user_id = _make_user(client)
    create = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    project_id = create.json()["id"]
    resp = client.patch(f"/api/projects/{project_id}", json={"daily_minutes": 90})
    assert resp.status_code == 200
    body = resp.json()
    assert body["daily_minutes"] == 90
    assert body["topic"] == "Adaptive learning"  # unchanged
    assert body["goal"] == "Ship the MVP"  # unchanged


def test_patch_can_soft_archive(client: TestClient):
    user_id = _make_user(client)
    create = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    project_id = create.json()["id"]
    resp = client.patch(f"/api/projects/{project_id}", json={"active": False})
    assert resp.status_code == 200
    assert resp.json()["active"] is False


def test_patch_clears_current_problem(client: TestClient):
    user_id = _make_user(client)
    create = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    project_id = create.json()["id"]
    resp = client.patch(f"/api/projects/{project_id}", json={"current_problem": None})
    assert resp.status_code == 200
    assert resp.json()["current_problem"] is None


def test_patch_unknown_project_404(client: TestClient):
    resp = client.patch("/api/projects/missing", json={"topic": "x"})
    assert resp.status_code == 404


def test_patch_rejects_invalid_daily_minutes(client: TestClient):
    user_id = _make_user(client)
    create = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    project_id = create.json()["id"]
    resp = client.patch(f"/api/projects/{project_id}", json={"daily_minutes": 0})
    assert resp.status_code == 422


def test_patch_empty_body_is_200_no_op(client: TestClient):
    user_id = _make_user(client)
    create = client.post(f"/api/users/{user_id}/projects", json=_project_body())
    before = create.json()
    resp = client.patch(f"/api/projects/{before['id']}", json={})
    assert resp.status_code == 200
    body = resp.json()
    # exclude_unset means nothing got overwritten.
    assert body["topic"] == before["topic"]
    assert body["daily_minutes"] == before["daily_minutes"]
    assert body["active"] == before["active"]
