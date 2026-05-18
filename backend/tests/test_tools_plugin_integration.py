"""Phase 3-E integration: tools plugin under app.main.app.

Two contracts:

1. GET /api/plugins/tools/recommendations/{project_id} returns a
   ranked list whose order tracks the latest LearningProfile.
2. The ``get_tool_recommendations`` hook dispatches list-mode
   through the production PluginManager.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, manager


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "ToolUser"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Tooling",
            "goal": "Pick learning tools.",
            "timeframe": "1 week",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _evaluate_with_first_answers(client: TestClient, project_id: str) -> dict:
    """Plant a deterministic LearningProfile by picking q.answers[0]
    for every assessment question. Returns the LearningProfileOut
    so the test can read the dominant_method."""
    questions = client.get("/api/plugins/assessment/questions?lang=en").json()
    answers = [{"question_id": q["id"], "answer_id": q["answers"][0]["id"]} for q in questions]
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={"project_id": project_id, "answers": answers},
    )
    assert resp.status_code == 201
    return resp.json()


# --- Plugin wiring --------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    active = {p.name for p in manager.get_active_plugins()}
    assert "tools" in active


def test_router_exposes_one_path(client: TestClient):
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/tools/recommendations/{project_id}" in paths


# --- GET /recommendations -------------------------------------------------


def test_recommendations_unknown_project_404(client: TestClient):
    resp = client.get("/api/plugins/tools/recommendations/no-such")
    assert resp.status_code == 404


def test_recommendations_unassessed_project_returns_baseline(client: TestClient):
    """Without an assessment profile, the plugin keeps the
    catalogue's authored order so the dashboard always shows
    the baseline tools."""
    _, project_id = _make_user_and_project(client)
    resp = client.get(f"/api/plugins/tools/recommendations/{project_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 3
    # Anki should be in the baseline set per project-reference §3.4.
    assert any(r["name"] == "Anki" for r in body)


def test_recommendations_after_assessment_are_profile_aware(client: TestClient):
    """The dominant method's tool should rank above the others
    once a profile exists."""
    _, project_id = _make_user_and_project(client)
    profile = _evaluate_with_first_answers(client, project_id)
    dominant = profile["dominant_method"]
    resp = client.get(f"/api/plugins/tools/recommendations/{project_id}")
    assert resp.status_code == 200
    body = resp.json()
    # The top recommendation must list the dominant method in its
    # weight_keys (since the catalogue covers every method, at
    # least one tool tags the dominant key).
    assert dominant in body[0]["weight_keys"], (
        f"Top tool {body[0]['name']!r} doesn't tag {dominant!r}; got {body}"
    )


def test_recommendations_localised_lang_query(client: TestClient):
    _, project_id = _make_user_and_project(client)
    de = client.get(f"/api/plugins/tools/recommendations/{project_id}?lang=de").json()
    en = client.get(f"/api/plugins/tools/recommendations/{project_id}?lang=en").json()
    # Same set of tools, different `why` text.
    assert {r["name"] for r in de} == {r["name"] for r in en}
    assert de[0]["why"] != en[0]["why"]


def test_recommendations_carry_required_fields(client: TestClient):
    _, project_id = _make_user_and_project(client)
    body = client.get(f"/api/plugins/tools/recommendations/{project_id}").json()
    for r in body:
        for key in ("name", "url", "why", "weight_keys", "score"):
            assert key in r, f"missing {key!r} in {r}"
        assert r["url"].startswith("https://")
        assert isinstance(r["weight_keys"], list)


def test_recommendations_results_sorted_by_score_desc(client: TestClient):
    _, project_id = _make_user_and_project(client)
    _evaluate_with_first_answers(client, project_id)
    body = client.get(f"/api/plugins/tools/recommendations/{project_id}").json()
    scores = [r["score"] for r in body]
    assert scores == sorted(scores, reverse=True)


def test_recommendations_never_leak_translation_keys(client: TestClient):
    _, project_id = _make_user_and_project(client)
    body = client.get(f"/api/plugins/tools/recommendations/{project_id}").json()
    for r in body:
        assert "why_de" not in r
        assert "why_en" not in r


# --- Hook dispatch -------------------------------------------------------


def test_get_tool_recommendations_hook_dispatches(client: TestClient):
    """List-mode dispatch: one plugin → one list of recommendations
    in the result wrapper. Confirms the Phase-3-D pattern (route
    merges results across plugins) lines up with what pluggy
    actually delivers."""
    results = manager._pm.hook.get_tool_recommendations(profile={"deductive": 0.9}, lang="en")
    assert len(results) == 1
    assert isinstance(results[0], list)
    assert all("name" in r for r in results[0])


# --- v0.4.0: GET /spaced/{project_id} -------------------------------------


def test_spaced_route_registered(client: TestClient):
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/tools/spaced/{project_id}" in paths


def test_spaced_unknown_project_404(client: TestClient):
    resp = client.get("/api/plugins/tools/spaced/no-such")
    assert resp.status_code == 404


def test_spaced_unassessed_project_returns_empty(client: TestClient):
    """No profile -> every method has weight 0 -> no cards."""
    _, project_id = _make_user_and_project(client)
    resp = client.get(f"/api/plugins/tools/spaced/{project_id}")
    assert resp.status_code == 200
    assert resp.json() == []


def test_spaced_after_assessment_returns_cards(client: TestClient):
    _, project_id = _make_user_and_project(client)
    _evaluate_with_first_answers(client, project_id)
    body = client.get(f"/api/plugins/tools/spaced/{project_id}").json()
    assert len(body) > 0
    for card in body:
        for key in ("id", "method", "interval_days", "action", "title", "urgency"):
            assert key in card, f"missing {key!r} in {card}"
        assert card["action"] == "session"
        assert card["interval_days"] in (1, 3, 7, 14)
        assert card["id"].startswith("sr-")


def test_spaced_localised_lang_query(client: TestClient):
    _, project_id = _make_user_and_project(client)
    _evaluate_with_first_answers(client, project_id)
    de = client.get(f"/api/plugins/tools/spaced/{project_id}?lang=de").json()
    en = client.get(f"/api/plugins/tools/spaced/{project_id}?lang=en").json()
    # Same set of cards (same ids), different title text.
    assert {c["id"] for c in de} == {c["id"] for c in en}
    assert de[0]["title"] != en[0]["title"]


def test_spaced_never_leaks_translation_keys(client: TestClient):
    _, project_id = _make_user_and_project(client)
    _evaluate_with_first_answers(client, project_id)
    body = client.get(f"/api/plugins/tools/spaced/{project_id}").json()
    for card in body:
        assert "title_de" not in card
        assert "title_en" not in card


def test_spaced_ordered_by_urgency_asc(client: TestClient):
    """Lower urgency value -> higher priority -> earlier in the
    list. Pin against future drift in the sort direction."""
    _, project_id = _make_user_and_project(client)
    _evaluate_with_first_answers(client, project_id)
    body = client.get(f"/api/plugins/tools/spaced/{project_id}").json()
    urgencies = [c["urgency"] for c in body]
    assert urgencies == sorted(urgencies)


def test_spaced_recency_pushes_recently_practised_methods_down(client: TestClient):
    """A method with a fresh ProgressCommit moves to the longer
    interval band (interval=14) and lands later in the response
    than one that's never been committed (interval=1)."""
    from app.database import SessionLocal
    from app.models import LearningSession, ProgressCommit

    _, project_id = _make_user_and_project(client)
    profile = _evaluate_with_first_answers(client, project_id)
    dominant = profile["dominant_method"]

    db = SessionLocal()
    try:
        # Plant a LearningSession + ProgressCommit for the
        # dominant method TODAY so the recency band for that
        # method becomes "maintain" (interval=14).
        sess = LearningSession(project_id=project_id, method=dominant, cycle_step=7)
        db.add(sess)
        db.commit()
        db.refresh(sess)
        commit = ProgressCommit(
            project_id=project_id,
            session_id=sess.id,
            method=dominant,
            understanding=0.7,
            stress=0.3,
            error_rate=0.1,
            duration_minutes=30,
        )
        db.add(commit)
        db.commit()
    finally:
        db.close()

    body = client.get(f"/api/plugins/tools/spaced/{project_id}").json()
    methods_in_order = [c["method"] for c in body]
    if dominant in methods_in_order and len(methods_in_order) > 1:
        # The dominant method, having been practised today, must
        # NOT be first anymore — at least one other method outranks
        # it on urgency.
        assert methods_in_order[0] != dominant
