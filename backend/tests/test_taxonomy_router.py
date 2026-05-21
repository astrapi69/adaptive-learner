"""Phase 22C integration tests: Subject + Tag + project-association routers."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient, name: str = "Learner") -> str:
    return client.post("/api/users", json={"name": name}).json()["id"]


def _make_project(client: TestClient, user_id: str, topic: str = "Spanish Grammar") -> str:
    payload = {
        "topic": topic,
        "goal": "Master conversational Spanish",
        "timeframe": "3 months",
        "daily_minutes": 30,
    }
    return client.post(f"/api/users/{user_id}/projects", json=payload).json()["id"]


# --- Subjects --------------------------------------------------------------


def test_list_subjects_returns_seed_data(client: TestClient):
    response = client.get("/api/subjects")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) > 0
    names = {row["name"] for row in rows}
    assert "Languages" in names
    assert "Programming" in names


def test_create_custom_subject(client: TestClient):
    response = client.post(
        "/api/subjects",
        json={"name": "Quantum Computing", "icon": "Q"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Quantum Computing"
    assert body["icon"] == "Q"
    assert body["parent_id"] is None


def test_create_subject_under_parent(client: TestClient):
    parent = client.post("/api/subjects", json={"name": "MyParent"}).json()
    response = client.post(
        "/api/subjects",
        json={"name": "MyChild", "parent_id": parent["id"]},
    )
    assert response.status_code == 201
    assert response.json()["parent_id"] == parent["id"]


def test_create_subject_unknown_parent_404(client: TestClient):
    response = client.post(
        "/api/subjects",
        json={"name": "Orphan", "parent_id": "does-not-exist"},
    )
    assert response.status_code == 404


def test_patch_subject_rename(client: TestClient):
    created = client.post("/api/subjects", json={"name": "Original"}).json()
    response = client.patch(
        f"/api/subjects/{created['id']}",
        json={"name": "Renamed"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_patch_subject_self_parent_rejected(client: TestClient):
    created = client.post("/api/subjects", json={"name": "SelfLoop"}).json()
    response = client.patch(
        f"/api/subjects/{created['id']}",
        json={"parent_id": created["id"]},
    )
    assert response.status_code == 400


def test_delete_subject_detaches_children(client: TestClient):
    parent = client.post("/api/subjects", json={"name": "DetachableParent"}).json()
    child = client.post(
        "/api/subjects", json={"name": "DetachableChild", "parent_id": parent["id"]}
    ).json()

    response = client.delete(f"/api/subjects/{parent['id']}")
    assert response.status_code == 204

    refreshed = client.get(f"/api/subjects/{child['id']}").json()
    assert refreshed["parent_id"] is None


# --- Tags ------------------------------------------------------------------


def test_create_and_list_tags(client: TestClient):
    user_id = _make_user(client)
    create = client.post(
        f"/api/users/{user_id}/tags",
        json={"name": "exam-prep", "color": "#ff0000"},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["name"] == "exam-prep"
    assert body["color"] == "#ff0000"

    listed = client.get(f"/api/users/{user_id}/tags").json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_create_tag_duplicate_name_conflict(client: TestClient):
    user_id = _make_user(client)
    client.post(f"/api/users/{user_id}/tags", json={"name": "daily"})
    response = client.post(f"/api/users/{user_id}/tags", json={"name": "daily"})
    assert response.status_code == 409


def test_create_tag_unknown_user_404(client: TestClient):
    response = client.post(
        "/api/users/does-not-exist/tags", json={"name": "anything"}
    )
    assert response.status_code == 404


def test_rename_tag(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/tags", json={"name": "old"}).json()
    response = client.patch(f"/api/tags/{created['id']}", json={"name": "new"})
    assert response.status_code == 200
    assert response.json()["name"] == "new"


def test_rename_tag_collides_with_existing_conflict(client: TestClient):
    user_id = _make_user(client)
    client.post(f"/api/users/{user_id}/tags", json={"name": "tag-a"})
    second = client.post(
        f"/api/users/{user_id}/tags", json={"name": "tag-b"}
    ).json()
    response = client.patch(f"/api/tags/{second['id']}", json={"name": "tag-a"})
    assert response.status_code == 409


def test_delete_tag(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/tags", json={"name": "ephemeral"}).json()
    response = client.delete(f"/api/tags/{created['id']}")
    assert response.status_code == 204
    listed = client.get(f"/api/users/{user_id}/tags").json()
    assert listed == []


# --- Project <-> Subject ---------------------------------------------------


def test_assign_subject_to_project(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    subject = client.post("/api/subjects", json={"name": "TestAssign"}).json()

    response = client.post(
        f"/api/projects/{project_id}/subjects",
        json={"subject_id": subject["id"]},
    )
    assert response.status_code == 201
    assigned = client.get(f"/api/projects/{project_id}/subjects").json()
    assert len(assigned) == 1
    assert assigned[0]["id"] == subject["id"]


def test_assign_subject_twice_is_idempotent(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    subject = client.post("/api/subjects", json={"name": "Idemp"}).json()

    client.post(
        f"/api/projects/{project_id}/subjects", json={"subject_id": subject["id"]}
    )
    response = client.post(
        f"/api/projects/{project_id}/subjects", json={"subject_id": subject["id"]}
    )
    assert response.status_code == 201
    assigned = client.get(f"/api/projects/{project_id}/subjects").json()
    assert len(assigned) == 1


def test_unassign_subject(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    subject = client.post("/api/subjects", json={"name": "ToRemove"}).json()
    client.post(
        f"/api/projects/{project_id}/subjects", json={"subject_id": subject["id"]}
    )

    response = client.delete(
        f"/api/projects/{project_id}/subjects/{subject['id']}"
    )
    assert response.status_code == 204
    assert client.get(f"/api/projects/{project_id}/subjects").json() == []


def test_unassign_subject_not_assigned_404(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    subject = client.post("/api/subjects", json={"name": "Untouched"}).json()
    response = client.delete(
        f"/api/projects/{project_id}/subjects/{subject['id']}"
    )
    assert response.status_code == 404


# --- Project <-> Tag -------------------------------------------------------


def test_assign_tag_to_project(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    tag = client.post(f"/api/users/{user_id}/tags", json={"name": "high"}).json()

    response = client.post(
        f"/api/projects/{project_id}/tags",
        json={"tag_id": tag["id"]},
    )
    assert response.status_code == 201
    assigned = client.get(f"/api/projects/{project_id}/tags").json()
    assert len(assigned) == 1
    assert assigned[0]["id"] == tag["id"]


def test_assign_tag_cross_user_rejected(client: TestClient):
    user_a = _make_user(client, "UserA")
    user_b = _make_user(client, "UserB")
    project_id = _make_project(client, user_a)
    # Tag belongs to UserB, project to UserA → bad request.
    tag = client.post(f"/api/users/{user_b}/tags", json={"name": "leak"}).json()
    response = client.post(
        f"/api/projects/{project_id}/tags",
        json={"tag_id": tag["id"]},
    )
    assert response.status_code == 400


def test_unassign_tag(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    tag = client.post(f"/api/users/{user_id}/tags", json={"name": "transient"}).json()
    client.post(f"/api/projects/{project_id}/tags", json={"tag_id": tag["id"]})

    response = client.delete(
        f"/api/projects/{project_id}/tags/{tag['id']}"
    )
    assert response.status_code == 204
    assert client.get(f"/api/projects/{project_id}/tags").json() == []
