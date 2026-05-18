"""Phase 5-E integration test: curriculum + topic routers.

CRUD + tree-shape contracts:
- Curriculum cascades to topics on delete (model-level cascade).
- Topic deletion uses SET NULL on children's parent_id (model
  contract); children become roots of their own subtrees.
- A topic's parent_id can move to any other topic in the same
  curriculum, but a cycle attempt (parent = a descendant of
  this topic) is rejected at the service layer.
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
    return client.post("/api/users", json={"name": "Learner"}).json()["id"]


def _make_curriculum(client: TestClient, user_id: str) -> str:
    return client.post(
        f"/api/users/{user_id}/curricula",
        json={"title": "Calculus", "language": "en"},
    ).json()["id"]


# --- Curriculum CRUD ------------------------------------------------------


def test_create_curriculum_succeeds(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/users/{user_id}/curricula",
        json={"title": "Linear Algebra"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["title"] == "Linear Algebra"
    assert body["language"] == "de"  # default


def test_create_curriculum_rejects_unknown_user_404(client: TestClient):
    resp = client.post(
        "/api/users/no-such/curricula",
        json={"title": "X"},
    )
    assert resp.status_code == 404


def test_list_curricula_returns_user_scoped(client: TestClient):
    user_a = _make_user(client)
    user_b = _make_user(client)
    _make_curriculum(client, user_a)
    _make_curriculum(client, user_a)
    _make_curriculum(client, user_b)
    resp_a = client.get(f"/api/users/{user_a}/curricula")
    resp_b = client.get(f"/api/users/{user_b}/curricula")
    assert len(resp_a.json()) == 2
    assert len(resp_b.json()) == 1


def test_get_curriculum_404(client: TestClient):
    resp = client.get("/api/curricula/no-such")
    assert resp.status_code == 404


def test_patch_curriculum(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    resp = client.patch(
        f"/api/curricula/{curriculum_id}",
        json={"title": "Calculus 2"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Calculus 2"


def test_delete_curriculum_cascades_to_topics(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Limits"},
    )
    resp = client.delete(f"/api/curricula/{curriculum_id}")
    assert resp.status_code == 204
    # Curriculum gone.
    assert client.get(f"/api/curricula/{curriculum_id}").status_code == 404


# --- Topic CRUD -----------------------------------------------------------


def test_create_topic_succeeds(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    resp = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Limits", "order_index": 0},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["curriculum_id"] == curriculum_id
    assert body["title"] == "Limits"
    assert body["parent_id"] is None


def test_create_topic_with_parent_in_same_curriculum(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    parent_id = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Limits"},
    ).json()["id"]
    resp = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Epsilon-delta", "parent_id": parent_id},
    )
    assert resp.status_code == 201
    assert resp.json()["parent_id"] == parent_id


def test_create_topic_rejects_cross_curriculum_parent(client: TestClient):
    user_id = _make_user(client)
    curriculum_a = _make_curriculum(client, user_id)
    curriculum_b = _make_curriculum(client, user_id)
    parent_in_a = client.post(
        f"/api/curricula/{curriculum_a}/topics",
        json={"title": "Limits"},
    ).json()["id"]
    resp = client.post(
        f"/api/curricula/{curriculum_b}/topics",
        json={"title": "Bad", "parent_id": parent_in_a},
    )
    assert resp.status_code == 400  # ValidationError -> 400
    assert "different curriculum" in resp.json()["detail"]


def test_list_topics_returns_ordered_by_index_then_created_at(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    # Two topics with order_index=2 + one with =0. Ordered list
    # should be: order=0 first, then the two order=2 in insertion
    # order.
    client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Beta", "order_index": 2},
    )
    client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Alpha", "order_index": 0},
    )
    client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Gamma", "order_index": 2},
    )
    resp = client.get(f"/api/curricula/{curriculum_id}/topics")
    titles = [t["title"] for t in resp.json()]
    assert titles == ["Alpha", "Beta", "Gamma"]


def test_patch_topic_rename(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    topic_id = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Limit"},
    ).json()["id"]
    resp = client.patch(
        f"/api/topics/{topic_id}",
        json={"title": "Limits and continuity"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Limits and continuity"


def test_patch_topic_move_parent(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    parent_a = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "A"},
    ).json()["id"]
    parent_b = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "B"},
    ).json()["id"]
    child = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "child", "parent_id": parent_a},
    ).json()["id"]
    resp = client.patch(
        f"/api/topics/{child}",
        json={"parent_id": parent_b},
    )
    assert resp.status_code == 200
    assert resp.json()["parent_id"] == parent_b


def test_patch_topic_rejects_self_parent(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    topic_id = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Self-cycle attempt"},
    ).json()["id"]
    resp = client.patch(
        f"/api/topics/{topic_id}",
        json={"parent_id": topic_id},
    )
    assert resp.status_code == 400
    assert "own parent" in resp.json()["detail"]


def test_patch_topic_rejects_descendant_parent_cycle(client: TestClient):
    """Set A's parent to a descendant of A -> would create a cycle.
    Service catches before it touches the DB."""
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    a = client.post(
        f"/api/curricula/{curriculum_id}/topics", json={"title": "A"}
    ).json()["id"]
    b = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "B", "parent_id": a},
    ).json()["id"]
    c = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "C", "parent_id": b},
    ).json()["id"]
    # Try to set A's parent to C (which is A's grandchild).
    resp = client.patch(f"/api/topics/{a}", json={"parent_id": c})
    assert resp.status_code == 400
    assert "cycle" in resp.json()["detail"]


def test_delete_topic_sets_children_parent_to_null(client: TestClient):
    """The model's ondelete='SET NULL' on parent_id contract:
    deleting a parent detaches the children rather than cascading."""
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    parent = client.post(
        f"/api/curricula/{curriculum_id}/topics", json={"title": "Parent"}
    ).json()["id"]
    child = client.post(
        f"/api/curricula/{curriculum_id}/topics",
        json={"title": "Child", "parent_id": parent},
    ).json()["id"]
    resp = client.delete(f"/api/topics/{parent}")
    assert resp.status_code == 204
    # Child still exists, parent_id is now None.
    child_resp = client.get(f"/api/topics/{child}")
    assert child_resp.status_code == 200
    assert child_resp.json()["parent_id"] is None


def test_delete_topic_404(client: TestClient):
    resp = client.delete("/api/topics/no-such")
    assert resp.status_code == 404


# --- Lesson CRUD (Phase 6B) -----------------------------------------------


def test_create_lesson_succeeds(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    resp = client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Limits intro", "content": "Lesson body."},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["curriculum_id"] == curriculum_id
    assert body["title"] == "Limits intro"
    assert body["content"] == "Lesson body."
    assert body["order_index"] == 0


def test_create_lesson_rejects_unknown_curriculum_404(client: TestClient):
    resp = client.post(
        "/api/curricula/no-such/lessons",
        json={"title": "X"},
    )
    assert resp.status_code == 404


def test_create_lesson_defaults_content_to_empty(client: TestClient):
    """Title-only creation is the common 'add lesson header now,
    fill body later' flow. The Pydantic body schema defaults
    ``content`` to ''."""
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    resp = client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Header only"},
    )
    assert resp.status_code == 201
    assert resp.json()["content"] == ""


def test_list_lessons_returns_curriculum_scoped(client: TestClient):
    user_id = _make_user(client)
    curriculum_a = _make_curriculum(client, user_id)
    curriculum_b = _make_curriculum(client, user_id)
    client.post(f"/api/curricula/{curriculum_a}/lessons", json={"title": "A1"})
    client.post(f"/api/curricula/{curriculum_a}/lessons", json={"title": "A2"})
    client.post(f"/api/curricula/{curriculum_b}/lessons", json={"title": "B1"})
    resp_a = client.get(f"/api/curricula/{curriculum_a}/lessons")
    resp_b = client.get(f"/api/curricula/{curriculum_b}/lessons")
    assert len(resp_a.json()) == 2
    assert len(resp_b.json()) == 1


def test_list_lessons_ordered_by_index_then_created_at(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Beta", "order_index": 2},
    )
    client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Alpha", "order_index": 0},
    )
    client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Gamma", "order_index": 2},
    )
    resp = client.get(f"/api/curricula/{curriculum_id}/lessons")
    titles = [l["title"] for l in resp.json()]
    assert titles == ["Alpha", "Beta", "Gamma"]


def test_get_lesson_returns_full_row(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    lesson_id = client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Lesson"},
    ).json()["id"]
    resp = client.get(f"/api/lessons/{lesson_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Lesson"


def test_get_lesson_404(client: TestClient):
    resp = client.get("/api/lessons/no-such")
    assert resp.status_code == 404


def test_patch_lesson_rename_and_set_content(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    lesson_id = client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Old"},
    ).json()["id"]
    resp = client.patch(
        f"/api/lessons/{lesson_id}",
        json={"title": "New title", "content": "Full body."},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New title"
    assert body["content"] == "Full body."


def test_patch_lesson_404_on_unknown(client: TestClient):
    resp = client.patch("/api/lessons/no-such", json={"title": "x"})
    assert resp.status_code == 404


def test_delete_lesson(client: TestClient):
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    lesson_id = client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Doomed"},
    ).json()["id"]
    resp = client.delete(f"/api/lessons/{lesson_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/lessons/{lesson_id}").status_code == 404


def test_delete_lesson_404(client: TestClient):
    resp = client.delete("/api/lessons/no-such")
    assert resp.status_code == 404


def test_delete_curriculum_cascades_to_lessons(client: TestClient):
    """Curriculum cascade=all,delete-orphan on the lessons
    relationship wipes every lesson alongside the curriculum."""
    user_id = _make_user(client)
    curriculum_id = _make_curriculum(client, user_id)
    lesson_id = client.post(
        f"/api/curricula/{curriculum_id}/lessons",
        json={"title": "Will cascade away"},
    ).json()["id"]
    client.delete(f"/api/curricula/{curriculum_id}")
    assert client.get(f"/api/lessons/{lesson_id}").status_code == 404
