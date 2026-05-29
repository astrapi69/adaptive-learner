"""Integration tests for the missions plugin (EXP-010 / Phase 56C).

Exercises the assign + evaluate + idempotency + regenerate flow
through the FastAPI routes against a real (in-memory) DB.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient) -> str:
    resp = client.post("/api/users", json={"name": "MissionTester"})
    assert resp.status_code in (200, 201)
    return resp.json()["id"]


def test_templates_endpoint_returns_catalog(client: TestClient):
    resp = client.get("/api/plugins/missions/templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert len(templates) >= 20
    assert all("check_function" in t for t in templates)


def test_today_assigns_three_missions(client: TestClient):
    user_id = _make_user(client)
    resp = client.get(f"/api/plugins/missions/today/{user_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["missions"]) == 3
    # A brand-new user (no lessons) only gets learning/exploration.
    for m in body["missions"]:
        assert m["template"]["category"] in {"learning", "exploration"}
        assert m["progress"] == 0
        assert m["completed"] is False
        assert m["target"] == m["template"]["target_value"]


def test_today_is_idempotent(client: TestClient):
    user_id = _make_user(client)
    first = client.get(f"/api/plugins/missions/today/{user_id}").json()
    second = client.get(f"/api/plugins/missions/today/{user_id}").json()
    assert [m["id"] for m in first["missions"]] == [m["id"] for m in second["missions"]]


def test_count_query_param_respected(client: TestClient):
    user_id = _make_user(client)
    body = client.get(f"/api/plugins/missions/today/{user_id}?count=1").json()
    assert len(body["missions"]) == 1


def test_regenerate_reassigns(client: TestClient):
    user_id = _make_user(client)
    client.get(f"/api/plugins/missions/today/{user_id}")
    resp = client.post(f"/api/plugins/missions/regenerate/{user_id}")
    assert resp.status_code == 200
    assert len(resp.json()["missions"]) == 3
