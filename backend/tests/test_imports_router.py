"""Phase 12C integration tests for the imports router."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.routers.imports import imports_router, users_imports_router
from app.routers.projects import projects_router, users_projects_router
from app.routers.users import router as users_router
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    return make_client(
        users_router,
        users_projects_router,
        projects_router,
        users_imports_router,
        imports_router,
    )


def _make_user(client: TestClient, name: str = "Aster") -> str:
    resp = client.post("/api/users", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _make_project(client: TestClient, user_id: str) -> str:
    resp = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Bayes",
            "goal": "Master it",
            "timeframe": "2 weeks",
            "daily_minutes": 30,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _conv_body(**overrides) -> dict:
    base = {
        "source": "chatgpt",
        "title": "Anonymised sample conversation",
        "messages": [
            {"role": "user", "content": "What is induction?"},
            {"role": "assistant", "content": "Induction generalises from examples."},
        ],
    }
    base.update(overrides)
    return base


# --- POST -------------------------------------------------------------------


def test_post_creates_conversation_201(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(f"/api/users/{user_id}/imports", json=_conv_body())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["source"] == "chatgpt"
    assert body["message_count"] == 2
    assert body["analyzed"] is False
    assert body["analysis_result"] is None


def test_post_requires_at_least_one_message(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/users/{user_id}/imports",
        json=_conv_body(messages=[]),
    )
    assert resp.status_code == 422


def test_post_404_when_user_missing(client: TestClient):
    resp = client.post("/api/users/stale-id/imports", json=_conv_body())
    assert resp.status_code == 404


def test_post_404_when_project_missing(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/users/{user_id}/imports",
        json=_conv_body(project_id="bogus"),
    )
    assert resp.status_code == 404


def test_post_400_when_project_belongs_to_other_user(client: TestClient):
    u1 = _make_user(client, "Alice")
    u2 = _make_user(client, "Bob")
    p2 = _make_project(client, u2)
    resp = client.post(
        f"/api/users/{u1}/imports",
        json=_conv_body(project_id=p2),
    )
    assert resp.status_code == 400


# --- GET --------------------------------------------------------------------


def test_list_returns_user_imports_newest_first(client: TestClient):
    user_id = _make_user(client)
    a = client.post(f"/api/users/{user_id}/imports", json=_conv_body(title="A")).json()
    b = client.post(f"/api/users/{user_id}/imports", json=_conv_body(title="B")).json()
    listing = client.get(f"/api/users/{user_id}/imports").json()
    assert [c["id"] for c in listing] == [b["id"], a["id"]]


def test_list_404_for_unknown_user(client: TestClient):
    resp = client.get("/api/users/stale/imports")
    assert resp.status_code == 404


def test_get_detail_includes_messages(client: TestClient):
    user_id = _make_user(client)
    created = client.post(
        f"/api/users/{user_id}/imports", json=_conv_body()
    ).json()
    resp = client.get(f"/api/imports/{created['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == created["id"]
    assert len(body["messages"]) == 2
    assert body["messages"][0]["order_index"] == 0
    assert body["messages"][1]["role"] == "assistant"


def test_get_detail_404_on_unknown_conversation(client: TestClient):
    resp = client.get("/api/imports/bogus")
    assert resp.status_code == 404


# --- PATCH ------------------------------------------------------------------


def test_patch_topic_tag(client: TestClient):
    user_id = _make_user(client)
    created = client.post(
        f"/api/users/{user_id}/imports", json=_conv_body()
    ).json()
    resp = client.patch(
        f"/api/imports/{created['id']}",
        json={"topic_tag": "philosophy"},
    )
    assert resp.status_code == 200
    assert resp.json()["topic_tag"] == "philosophy"


def test_patch_assign_project(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    created = client.post(
        f"/api/users/{user_id}/imports", json=_conv_body()
    ).json()
    resp = client.patch(
        f"/api/imports/{created['id']}",
        json={"project_id": project_id},
    )
    assert resp.status_code == 200
    assert resp.json()["project_id"] == project_id


def test_patch_reject_cross_user_project(client: TestClient):
    u1 = _make_user(client, "Alice")
    u2 = _make_user(client, "Bob")
    p2 = _make_project(client, u2)
    created = client.post(
        f"/api/users/{u1}/imports", json=_conv_body()
    ).json()
    resp = client.patch(
        f"/api/imports/{created['id']}",
        json={"project_id": p2},
    )
    assert resp.status_code == 400


# --- DELETE -----------------------------------------------------------------


def test_delete_returns_204_and_removes(client: TestClient):
    user_id = _make_user(client)
    created = client.post(
        f"/api/users/{user_id}/imports", json=_conv_body()
    ).json()
    resp = client.delete(f"/api/imports/{created['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/imports/{created['id']}").status_code == 404


# --- Analysis ---------------------------------------------------------------


def test_save_analysis_persists_blob_and_flips_analyzed(client: TestClient):
    user_id = _make_user(client)
    created = client.post(
        f"/api/users/{user_id}/imports", json=_conv_body()
    ).json()
    analysis = {
        "topic": "Induction",
        "user_level": "beginner",
        "strengths": ["clear question"],
        "weaknesses": ["mixes deduction with induction"],
        "recommended_method": "inductive",
    }
    resp = client.post(
        f"/api/imports/{created['id']}/analysis",
        json={"analysis_result": analysis},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["analyzed"] is True
    assert body["analysis_result"]["topic"] == "Induction"
    # Detail endpoint preserves it.
    detail = client.get(f"/api/imports/{created['id']}").json()
    assert detail["analyzed"] is True
    assert detail["analysis_result"]["user_level"] == "beginner"


def test_save_analysis_404_on_unknown_conversation(client: TestClient):
    resp = client.post(
        "/api/imports/bogus/analysis",
        json={"analysis_result": {"topic": "x"}},
    )
    assert resp.status_code == 404
