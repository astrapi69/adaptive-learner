"""Phase 3-A integration test: assessment plugin under app.main.app.

Mirrors the per-router integration approach from Phase 1C-E:
``with TestClient(app)`` boots the lifespan, which discovers the
``assessment`` plugin (enabled in backend/config/app.yaml) and
mounts its three routes under ``/api``.
"""

from __future__ import annotations

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.main import app, manager
from app.openapi_metadata import iter_api_routes


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# --- Plugin wiring ----------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    """Sanity: app.main.lifespan ran discover_plugins, the
    ``assessment`` entry point loaded, and the plugin survived
    activation. Without this, every assertion below would 404.
    """
    active_names = {p.name for p in manager.get_active_plugins()}
    assert "assessment" in active_names


def test_router_exposes_three_paths(client: TestClient):
    """Pin the three documented paths land under the /api prefix."""
    paths = {r.path for r in iter_api_routes(app)}
    assert "/api/plugins/assessment/questions" in paths
    assert "/api/plugins/assessment/evaluate" in paths
    assert "/api/plugins/assessment/profile/{project_id}" in paths


def test_plugin_router_object_is_apirouter():
    """``get_routes`` returns the expected shape (lazy import works)."""
    from adaptive_learner_assessment.plugin import AssessmentPlugin

    routes = AssessmentPlugin().get_routes()
    assert len(routes) == 1
    assert isinstance(routes[0], APIRouter)
    assert routes[0].prefix == "/plugins/assessment"


# --- GET /questions ---------------------------------------------------------


def test_get_questions_default_language(client: TestClient):
    resp = client.get("/api/plugins/assessment/questions")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 12
    assert body[0]["id"] == "q01"
    assert isinstance(body[0]["text"], str) and body[0]["text"]
    for answer in body[0]["answers"]:
        assert answer["id"]
        assert answer["text"]
        assert isinstance(answer["weights"], dict)


def test_get_questions_returns_german_by_default(client: TestClient):
    """``lang`` defaults to 'de' per the route signature."""
    body = client.get("/api/plugins/assessment/questions").json()
    # German fixture: q01 starts with "Wie".
    assert body[0]["text"].startswith("Wie")


def test_get_questions_lang_en(client: TestClient):
    body = client.get("/api/plugins/assessment/questions?lang=en").json()
    assert body[0]["text"].startswith("How")


def test_get_questions_does_not_leak_translation_keys(client: TestClient):
    body = client.get("/api/plugins/assessment/questions").json()
    for q in body:
        assert "text_de" not in q
        assert "text_en" not in q


# --- POST /evaluate ---------------------------------------------------------


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "Assessor"})
    assert u.status_code == 201, u.text
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Adaptive learning",
            "goal": "Find my method.",
            "timeframe": "4 weeks",
            "daily_minutes": 30,
        },
    )
    assert p.status_code == 201, p.text
    return user_id, p.json()["id"]


def _all_first_answers(client: TestClient) -> list[dict]:
    questions = client.get("/api/plugins/assessment/questions").json()
    return [{"question_id": q["id"], "answer_id": q["answers"][0]["id"]} for q in questions]


def test_evaluate_persists_a_learning_profile(client: TestClient):
    _, project_id = _make_user_and_project(client)
    body = {"project_id": project_id, "answers": _all_first_answers(client)}
    resp = client.post("/api/plugins/assessment/evaluate", json=body)
    assert resp.status_code == 201, resp.text
    profile = resp.json()
    assert profile["project_id"] == project_id
    assert profile["version"] == 1
    # All six method-weight floats present + in [0, 1].
    for method in (
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    ):
        assert 0.0 <= profile[method] <= 1.0
    assert profile["dominant_method"] in (
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    )


def test_evaluate_unknown_project_returns_404(client: TestClient):
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={"project_id": "no-such", "answers": [{"question_id": "q01", "answer_id": "a"}]},
    )
    assert resp.status_code == 404


def test_evaluate_empty_answers_returns_422(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={"project_id": project_id, "answers": []},
    )
    assert resp.status_code == 422


def test_evaluate_bumps_version_on_repeat(client: TestClient):
    _, project_id = _make_user_and_project(client)
    body = {"project_id": project_id, "answers": _all_first_answers(client)}
    v1 = client.post("/api/plugins/assessment/evaluate", json=body).json()
    v2 = client.post("/api/plugins/assessment/evaluate", json=body).json()
    assert v1["version"] == 1
    assert v2["version"] == 2
    assert v1["id"] != v2["id"]  # prior row preserved for history


# --- GET /profile/{project_id} ---------------------------------------------


def test_get_latest_profile_returns_highest_version(client: TestClient):
    _, project_id = _make_user_and_project(client)
    body = {"project_id": project_id, "answers": _all_first_answers(client)}
    client.post("/api/plugins/assessment/evaluate", json=body)
    client.post("/api/plugins/assessment/evaluate", json=body)
    resp = client.get(f"/api/plugins/assessment/profile/{project_id}")
    assert resp.status_code == 200
    assert resp.json()["version"] == 2


def test_get_latest_profile_unknown_project_returns_404(client: TestClient):
    resp = client.get("/api/plugins/assessment/profile/does-not-exist")
    assert resp.status_code == 404


def test_get_latest_profile_unassessed_project_returns_404(client: TestClient):
    """Project exists but has never been through /evaluate."""
    _, project_id = _make_user_and_project(client)
    resp = client.get(f"/api/plugins/assessment/profile/{project_id}")
    assert resp.status_code == 404


# --- Hook integration -----------------------------------------------------


def test_get_assessment_questions_hook_dispatches(client: TestClient):
    """The hookspec from Phase 2 routes calls to the plugin
    implementation. Confirms pluggy's wiring works end-to-end (the
    Phase 3-C session plugin will use this path)."""
    results = manager._pm.hook.get_assessment_questions(lang="de")
    # List-mode dispatch: one plugin -> list of one return value.
    assert len(results) == 1
    questions = results[0]
    assert len(questions) == 12
    assert questions[0]["id"] == "q01"


def test_calculate_profile_hook_dispatches(client: TestClient):
    answers = [
        {"question_id": "q01", "answer_id": "a"},  # purely deductive
    ]
    results = manager._pm.hook.calculate_profile(answers=answers)
    assert len(results) == 1
    out = results[0]
    assert set(out.keys()) == {
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    }
    # 1 deductive answer out of 12 questions => deductive = 1/12 ≈ 0.0833.
    assert 0.08 <= out["deductive"] <= 0.09


# --- v0.4.0: multi-select ``answer_ids`` ----------------------------------


def test_questions_response_carries_type_field(client: TestClient):
    """Every question in the public response declares ``type``
    so the frontend can pick radio vs checkbox rendering."""
    resp = client.get("/api/plugins/assessment/questions?lang=en")
    assert resp.status_code == 200
    body = resp.json()
    for q in body:
        assert q["type"] in ("single", "multi")


def test_evaluate_accepts_multi_select_answer_ids(client: TestClient):
    """A multi-select pick is submitted via ``answer_ids: [...]``
    and the route persists the resulting profile."""
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={
            "project_id": project_id,
            "answers": [
                {"question_id": "q01", "answer_ids": ["a", "b"]},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    # q01.a is deductive 1.0, q01.b is inductive 1.0 — each gets
    # halved, then divided by 12 questions => ≈ 0.0417 each.
    assert 0.04 <= body["deductive"] <= 0.05
    assert 0.04 <= body["inductive"] <= 0.05


def test_evaluate_rejects_empty_answer_ids_422(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={
            "project_id": project_id,
            "answers": [{"question_id": "q01", "answer_ids": []}],
        },
    )
    assert resp.status_code == 422


def test_evaluate_rejects_neither_answer_id_nor_answer_ids_422(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={
            "project_id": project_id,
            "answers": [{"question_id": "q01"}],
        },
    )
    assert resp.status_code == 422


def test_evaluate_legacy_answer_id_still_works(client: TestClient):
    """Backward compatibility: existing single-select clients keep
    working without sending ``answer_ids``."""
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/assessment/evaluate",
        json={
            "project_id": project_id,
            "answers": [{"question_id": "q01", "answer_id": "a"}],
        },
    )
    assert resp.status_code == 201, resp.text
