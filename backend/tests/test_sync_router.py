"""Phase 13A integration tests for the sync router.

Exercises the full append-only / mutable / conflict / resolve
matrix plus the pairing-token round-trip. The harness uses two
in-memory databases via the standard router_test_client fixture;
we simulate "two devices" by pushing/pulling between them in the
same process.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.routers.curriculum import (
    curricula_router,
    lessons_router,
    topics_router,
    users_curricula_router,
)
from app.routers.projects import projects_router, users_projects_router
from app.routers.sync import router as sync_router
from app.routers.users import router as users_router
from app.services import pairing as pairing_service
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    pairing_service._reset_for_tests()
    return make_client(
        users_router,
        users_projects_router,
        projects_router,
        users_curricula_router,
        curricula_router,
        topics_router,
        lessons_router,
        sync_router,
    )


def _make_user(client: TestClient, name: str = "Aster") -> str:
    resp = client.post("/api/users", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _make_project(client: TestClient, user_id: str, topic: str = "Bayes") -> dict:
    resp = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": topic,
            "goal": "Master it",
            "timeframe": "2 weeks",
            "daily_minutes": 30,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# /status
# ---------------------------------------------------------------------------


def test_status_returns_counts_per_table(client: TestClient):
    user_id = _make_user(client)
    _make_project(client, user_id)
    resp = client.get(f"/api/sync/status?user_id={user_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["counts"]["users"] == 1
    assert body["counts"]["learning_projects"] == 1
    assert body["counts"]["session_messages"] == 0
    assert "server_time" in body


def test_status_404_on_unknown_user(client: TestClient):
    resp = client.get("/api/sync/status?user_id=bogus")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /push — append-only
# ---------------------------------------------------------------------------


def test_push_append_only_inserts_unknown_rows(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id)
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": user_id,
            "table": "learning_sessions",
            "since": None,
            "records": [
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "project_id": project["id"],
                    "method": "inductive",
                    "started_at": "2026-05-20T10:00:00+00:00",
                    "ended_at": None,
                    "cycle_step": 1,
                    "status": "active",
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["accepted"] == ["11111111-1111-1111-1111-111111111111"]
    assert body["conflicts"] == []


def test_push_append_only_is_idempotent(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id)
    record = {
        "id": "22222222-2222-2222-2222-222222222222",
        "project_id": project["id"],
        "method": "inductive",
        "started_at": "2026-05-20T10:00:00+00:00",
        "ended_at": None,
        "cycle_step": 1,
        "status": "active",
    }
    body = {
        "user_id": user_id,
        "table": "learning_sessions",
        "records": [record],
    }
    first = client.post("/api/sync/push", json=body).json()
    second = client.post("/api/sync/push", json=body).json()
    assert first["accepted"] == [record["id"]]
    assert second["accepted"] == []
    assert second["skipped"] == [record["id"]]


# ---------------------------------------------------------------------------
# /push — mutable
# ---------------------------------------------------------------------------


def test_push_mutable_accept_remote_when_local_untouched(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id, topic="Original")
    far_future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": user_id,
            "table": "learning_projects",
            "since": far_future,  # "local was untouched since far future"
            "records": [
                {
                    **project,
                    "topic": "Updated remotely",
                }
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["accepted"] == [project["id"]]
    refreshed = client.get(f"/api/projects/{project['id']}").json()
    assert refreshed["topic"] == "Updated remotely"


def test_push_mutable_flags_conflict_when_both_changed(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id, topic="Original")
    # Touch local (project updated_at moves forward).
    client.patch(
        f"/api/projects/{project['id']}",
        json={"topic": "Edited locally"},
    )
    long_ago = "2020-01-01T00:00:00+00:00"
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": user_id,
            "table": "learning_projects",
            "since": long_ago,  # Last sync was way before the local edit.
            "records": [
                {
                    **project,
                    "topic": "Edited remotely",
                }
            ],
        },
    )
    body = resp.json()
    assert resp.status_code == 200
    assert body["accepted"] == []
    assert len(body["conflicts"]) == 1
    conflict = body["conflicts"][0]
    assert conflict["table"] == "learning_projects"
    assert conflict["id"] == project["id"]
    assert conflict["local"]["topic"] == "Edited locally"
    assert conflict["remote"]["topic"] == "Edited remotely"


def test_push_rejects_unknown_table(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        "/api/sync/push",
        json={
            "user_id": user_id,
            "table": "bogus_table",
            "records": [],
        },
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /pull
# ---------------------------------------------------------------------------


def test_pull_returns_all_when_since_is_null(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id)
    resp = client.post(
        "/api/sync/pull",
        json={"user_id": user_id, "tables": ["users", "learning_projects"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["records"]["users"]) == 1
    assert body["records"]["users"][0]["id"] == user_id
    assert len(body["records"]["learning_projects"]) == 1
    assert body["records"]["learning_projects"][0]["id"] == project["id"]


def test_pull_filters_by_since_timestamp(client: TestClient):
    user_id = _make_user(client)
    _make_project(client, user_id, topic="First")
    cutoff = datetime.now(UTC).isoformat()
    time.sleep(0.01)  # ensure later row has a strictly-greater timestamp
    _make_project(client, user_id, topic="Second")
    resp = client.post(
        "/api/sync/pull",
        json={
            "user_id": user_id,
            "tables": ["learning_projects"],
            "since": cutoff,
        },
    )
    projects = resp.json()["records"]["learning_projects"]
    assert len(projects) == 1
    assert projects[0]["topic"] == "Second"


def test_pull_scopes_to_user(client: TestClient):
    alice = _make_user(client, "Alice")
    bob = _make_user(client, "Bob")
    _make_project(client, alice, topic="Alice's project")
    _make_project(client, bob, topic="Bob's project")
    resp = client.post(
        "/api/sync/pull",
        json={"user_id": alice, "tables": ["learning_projects"]},
    )
    projects = resp.json()["records"]["learning_projects"]
    assert len(projects) == 1
    assert projects[0]["topic"] == "Alice's project"


def test_pull_rejects_unknown_tables(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        "/api/sync/pull",
        json={"user_id": user_id, "tables": ["bogus"]},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /resolve
# ---------------------------------------------------------------------------


def test_resolve_applies_merged_payload(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id, topic="Original")
    resp = client.post(
        "/api/sync/resolve",
        json={
            "user_id": user_id,
            "resolutions": [
                {
                    "table": "learning_projects",
                    "id": project["id"],
                    "chosen": "merged",
                    "merged_data": {
                        **project,
                        "topic": "Merged result",
                    },
                }
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["applied"] == [project["id"]]
    refreshed = client.get(f"/api/projects/{project['id']}").json()
    assert refreshed["topic"] == "Merged result"


def test_resolve_keep_local_is_noop(client: TestClient):
    user_id = _make_user(client)
    project = _make_project(client, user_id, topic="Kept")
    resp = client.post(
        "/api/sync/resolve",
        json={
            "user_id": user_id,
            "resolutions": [
                {
                    "table": "learning_projects",
                    "id": project["id"],
                    "chosen": "local",
                }
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["applied"] == [project["id"]]
    refreshed = client.get(f"/api/projects/{project['id']}").json()
    assert refreshed["topic"] == "Kept"


def test_resolve_skips_unknown_table(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        "/api/sync/resolve",
        json={
            "user_id": user_id,
            "resolutions": [
                {
                    "table": "bogus_table",
                    "id": "x",
                    "chosen": "local",
                }
            ],
        },
    )
    body = resp.json()
    assert resp.status_code == 200
    assert "x" in body["skipped"]


# ---------------------------------------------------------------------------
# /pair
# ---------------------------------------------------------------------------


def test_pair_generate_returns_token_and_expiry(client: TestClient):
    user_id = _make_user(client, "Aster")
    resp = client.post(
        "/api/sync/pair/generate",
        json={"user_id": user_id},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["user_name"] == "Aster"
    assert len(body["token"]) == 32  # 16 random bytes → 32 hex chars
    assert "expires_at" in body


def test_pair_generate_404_on_unknown_user(client: TestClient):
    resp = client.post(
        "/api/sync/pair/generate",
        json={"user_id": "bogus"},
    )
    assert resp.status_code == 404


def test_pair_verify_consumes_token_and_returns_user(client: TestClient):
    user_id = _make_user(client, "Aster")
    gen = client.post(
        "/api/sync/pair/generate",
        json={"user_id": user_id},
    ).json()
    resp = client.post(
        "/api/sync/pair/verify",
        json={"token": gen["token"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["user"]["id"] == user_id
    assert body["user"]["name"] == "Aster"


def test_pair_verify_404_when_token_already_used(client: TestClient):
    user_id = _make_user(client, "Aster")
    gen = client.post(
        "/api/sync/pair/generate",
        json={"user_id": user_id},
    ).json()
    # First call consumes the token.
    client.post("/api/sync/pair/verify", json={"token": gen["token"]})
    # Second call must fail.
    resp = client.post(
        "/api/sync/pair/verify",
        json={"token": gen["token"]},
    )
    assert resp.status_code == 404


def test_pair_verify_404_on_unknown_token(client: TestClient):
    resp = client.post(
        "/api/sync/pair/verify",
        json={"token": "deadbeef" * 4},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# End-to-end: simulate two devices via pull + push
# ---------------------------------------------------------------------------


def test_two_device_round_trip(client: TestClient):
    """The classic flow: device A writes, syncs to device B, B sees it."""
    user_id = _make_user(client, "Aster")
    project = _make_project(client, user_id, topic="On device A")

    # Device B "pulls" the full state.
    pulled = client.post(
        "/api/sync/pull",
        json={"user_id": user_id, "tables": None},
    ).json()
    assert len(pulled["records"]["users"]) == 1
    assert len(pulled["records"]["learning_projects"]) == 1
    assert pulled["records"]["learning_projects"][0]["topic"] == "On device A"

    # Device B writes a session locally and "pushes" it back.
    session_id = "33333333-3333-3333-3333-333333333333"
    push = client.post(
        "/api/sync/push",
        json={
            "user_id": user_id,
            "table": "learning_sessions",
            "records": [
                {
                    "id": session_id,
                    "project_id": project["id"],
                    "method": "deductive",
                    "started_at": "2026-05-20T11:00:00+00:00",
                    "ended_at": None,
                    "cycle_step": 1,
                    "status": "active",
                }
            ],
        },
    ).json()
    assert push["accepted"] == [session_id]

    # /status now reflects the new session.
    s = client.get(f"/api/sync/status?user_id={user_id}").json()
    assert s["counts"]["learning_sessions"] == 1
