"""Phase 3-C integration: session plugin under app.main.app.

Covers the 4-route lifecycle (start → message → rate → end), the
``create_session_prompt`` + ``recommend_method_switch`` hook
dispatch through the production PluginManager, and the
``on_session_complete`` fan-out the /end handler fires.
"""

from __future__ import annotations

import pluggy
import pytest
from fastapi.testclient import TestClient

from app.main import app, manager

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "Learner"})
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
    return user_id, p.json()["id"]


# --- Plugin wiring ---------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    active = {p.name for p in manager.get_active_plugins()}
    assert "session" in active


def test_router_exposes_four_paths(client: TestClient):
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/session/start" in paths
    assert "/api/plugins/session/{session_id}/message" in paths
    assert "/api/plugins/session/{session_id}/rate" in paths
    assert "/api/plugins/session/{session_id}/end" in paths


# --- POST /start -----------------------------------------------------------


def test_start_creates_session_with_default_method(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post("/api/plugins/session/start", json={"project_id": project_id})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["session"]["project_id"] == project_id
    assert body["session"]["status"] == "active"
    assert body["session"]["cycle_step"] == 1
    # No profile yet => fallback to deductive.
    assert body["session"]["method"] == "deductive"
    assert isinstance(body["system_prompt"], str)
    assert len(body["system_prompt"]) > 0


def test_start_uses_explicit_method_when_supplied(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "dialogic", "cycle_step": 3},
    )
    body = resp.json()
    assert body["session"]["method"] == "dialogic"
    assert body["session"]["cycle_step"] == 3


def test_start_uses_dominant_method_from_profile(client: TestClient):
    """When a LearningProfile exists, /start seeds the session with
    its dominant method (whatever that ends up being for this
    fixture) instead of the static "deductive" fallback."""
    _, project_id = _make_user_and_project(client)
    questions = client.get("/api/plugins/assessment/questions?lang=en").json()
    # Pick the first answer of each question — deterministic shape
    # the profile dominant method can be looked up against.
    answers = [{"question_id": q["id"], "answer_id": q["answers"][0]["id"]} for q in questions]
    profile = client.post(
        "/api/plugins/assessment/evaluate",
        json={"project_id": project_id, "answers": answers},
    ).json()
    expected_method = profile["dominant_method"]

    resp = client.post("/api/plugins/session/start", json={"project_id": project_id})
    # The session method matches whatever the profile said is dominant —
    # confirms the profile-driven path is firing (not the static
    # "deductive" fallback path).
    assert resp.json()["session"]["method"] == expected_method


def test_start_unknown_project_404(client: TestClient):
    resp = client.post("/api/plugins/session/start", json={"project_id": "no-such"})
    assert resp.status_code == 404


def test_start_rejects_invalid_cycle_step_422(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "cycle_step": 99},
    )
    assert resp.status_code == 422


def test_start_includes_project_topic_in_prompt(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "lang": "de"},
    )
    prompt = resp.json()["system_prompt"]
    assert "Adaptive learning" in prompt
    assert "Lernprojekt" in prompt  # German shell


# --- POST /{id}/message ---------------------------------------------------


def test_message_stores_user_message(client: TestClient):
    """v0.2.0: POST /message returns a composite with the saved
    user message + an optional assistant reply. With no API key
    configured in this test fixture, ``assistant_message`` is
    ``None`` and ``ai_error`` explains why."""
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "What's a class?"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_message"]["session_id"] == sess_id
    assert body["user_message"]["role"] == "user"
    assert body["user_message"]["content"] == "What's a class?"
    # No API key in this fixture -> AI step is skipped; the user
    # message is still persisted.
    assert body["assistant_message"] is None
    assert isinstance(body["ai_error"], str)


def test_message_stores_assistant_message(client: TestClient):
    """role=assistant writes bypass the AI step (no recursion) and
    just persist the message; the composite still wraps it under
    ``user_message`` so the route's return contract stays stable.
    """
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "assistant", "content": "A class is..."},
    )
    body = resp.json()
    assert body["user_message"]["role"] == "assistant"
    assert body["user_message"]["content"] == "A class is..."
    assert body["assistant_message"] is None
    # role != user => no AI step, no ai_error either.
    assert body["ai_error"] is None


def test_message_rejects_unknown_session_404(client: TestClient):
    resp = client.post(
        "/api/plugins/session/no-such/message",
        json={"role": "user", "content": "x"},
    )
    assert resp.status_code == 404


def test_message_rejects_empty_content_422(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": ""},
    )
    assert resp.status_code == 422


def test_message_rejected_on_closed_session(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    client.post(f"/api/plugins/session/{sess_id}/end")
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Late"},
    )
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"]


# --- POST /{id}/rate -------------------------------------------------------


def test_rate_persists_rating(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/rate",
        json={"understanding": 4, "stress": 2, "method_fit": 5, "notes": "good"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["understanding"] == 4
    assert body["stress"] == 2
    assert body["method_fit"] == 5
    assert body["notes"] == "good"


def test_rate_rejects_out_of_range_422(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/rate",
        json={"understanding": 10, "stress": 3, "method_fit": 3},
    )
    assert resp.status_code == 422


# --- POST /{id}/end --------------------------------------------------------


def test_end_marks_session_completed(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    resp = client.post(f"/api/plugins/session/{sess_id}/end")
    assert resp.status_code == 200
    body = resp.json()
    assert body["session"]["status"] == "completed"
    assert body["session"]["ended_at"] is not None


def test_end_is_idempotent(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    first = client.post(f"/api/plugins/session/{sess_id}/end").json()
    second = client.post(f"/api/plugins/session/{sess_id}/end").json()
    assert first["session"]["status"] == "completed"
    assert second["session"]["status"] == "completed"
    assert first["session"]["ended_at"] == second["session"]["ended_at"]


def test_end_fires_on_session_complete_hook(client: TestClient):
    """Register a transient subscriber, end a session, observe the
    call. Cleans up after itself so other tests stay isolated."""

    class _Spy:
        name = "_test-on-complete-spy"
        calls: list[tuple[dict, dict]] = []

        @hookimpl
        def on_session_complete(self, session, rating):
            type(self).calls.append((session, rating))

    spy = _Spy()
    spy.calls.clear()
    manager._pm.register(spy)
    try:
        _, project_id = _make_user_and_project(client)
        sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
            "session"
        ]["id"]
        client.post(
            f"/api/plugins/session/{sess_id}/rate",
            json={"understanding": 3, "stress": 3, "method_fit": 3},
        )
        client.post(f"/api/plugins/session/{sess_id}/end")
        assert len(spy.calls) == 1
        session_arg, rating_arg = spy.calls[0]
        assert session_arg["id"] == sess_id
        assert session_arg["status"] == "completed"
        assert rating_arg["understanding"] == 3
    finally:
        manager._pm.unregister(spy)


def test_end_swallows_hook_subscriber_exceptions(client: TestClient):
    """The hookspec contract: subscriber errors MUST NOT roll back
    the session close. The /end handler logs + continues."""

    class _Boom:
        name = "_test-boom-spy"

        @hookimpl
        def on_session_complete(self, session, rating):
            raise RuntimeError("intentional test failure")

    boom = _Boom()
    manager._pm.register(boom)
    try:
        _, project_id = _make_user_and_project(client)
        sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
            "session"
        ]["id"]
        resp = client.post(f"/api/plugins/session/{sess_id}/end")
        assert resp.status_code == 200
        assert resp.json()["session"]["status"] == "completed"
    finally:
        manager._pm.unregister(boom)


# --- Hook dispatch (firstresult + list-mode) ------------------------------


def test_create_session_prompt_hook_dispatches(client: TestClient):
    """firstresult=True: session plugin is the only implementer →
    its result wins."""
    result = manager._pm.hook.create_session_prompt(
        project={"topic": "Python", "goal": "classes"},
        profile={"deductive": 0.8},
        method="deductive",
        step=1,
        lang="en",
    )
    assert isinstance(result, str)
    assert "Python" in result


def test_create_session_prompt_returns_none_on_invalid_method(client: TestClient):
    result = manager._pm.hook.create_session_prompt(
        project={"topic": "x", "goal": "y"},
        profile={},
        method="telekinesis",
        step=1,
        lang="en",
    )
    assert result is None


def test_recommend_method_switch_dispatches(client: TestClient):
    results = manager._pm.hook.recommend_method_switch(
        project_id="p1",
        current_method="deductive",
        recent_ratings=[{"understanding": 3, "stress": 5}] * 3,
    )
    # List-mode: one plugin -> one entry (not None for stagnant+stressed).
    assert len(results) == 1
    assert results[0] is not None
    assert results[0]["from_method"] == "deductive"
    assert results[0]["to_method"] != "deductive"


def test_recommend_method_switch_returns_none_on_improving(client: TestClient):
    results = manager._pm.hook.recommend_method_switch(
        project_id="p1",
        current_method="deductive",
        recent_ratings=[
            {"understanding": 2, "stress": 5},
            {"understanding": 3, "stress": 5},
            {"understanding": 5, "stress": 5},
        ],
    )
    # pluggy strips None from list-mode dispatch — a None-returning
    # plugin contributes nothing to the result list. With session
    # as the only registered impl, "no recommendation" looks like
    # an empty list, not [None].
    assert results == []


# --- v0.2.0: AI orchestration through POST /message -----------------------


@pytest.fixture()
def mock_ai_plugin():
    """Register a stub ai_complete hookimpl that the test can
    configure at runtime. The hookimpl method on the class is
    decorated at definition time; pluggy resolves the bound
    method when it dispatches, so the indirection through
    ``self.reply`` / ``self.raise_on_call`` is what lets tests
    swap behaviour after the fixture yields.

    Yields the plugin instance; auto-unregisters on teardown.
    """

    class _FakeAi:
        name = "fake-ai"
        api_version = "1"
        reply: str | None = "Hello from FakeAI."
        raise_on_call: BaseException | None = None

        @hookimpl(tryfirst=True)
        def ai_complete(self, messages, model, api_key):
            del messages, model, api_key
            if self.raise_on_call is not None:
                raise self.raise_on_call
            return self.reply

    plugin = _FakeAi()
    manager._pm.register(plugin)
    try:
        yield plugin
    finally:
        manager._pm.unregister(plugin)


def _seed_api_key(client: TestClient, user_id: str, provider: str = "anthropic") -> None:
    """Helper: POST a fake API key for the user so the AI orchestration
    can find a credential. The crypto service stores the encrypted
    form; the route decrypts on read. The actual key string never
    leaves the test process — the fake plugin ignores it."""
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": provider, "key": "sk-fake-test-key"},
    )
    assert resp.status_code == 200, resp.text


def test_message_orchestrates_ai_and_persists_assistant_reply(
    client: TestClient, mock_ai_plugin
):
    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id, provider="anthropic")
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]

    mock_ai_plugin.reply = "Inheritance lets a class reuse another class."
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Explain inheritance."},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_message"]["content"] == "Explain inheritance."
    assert body["assistant_message"] is not None
    assert body["assistant_message"]["role"] == "assistant"
    assert body["assistant_message"]["content"] == (
        "Inheritance lets a class reuse another class."
    )
    assert body["ai_error"] is None
    # v0.4.0: the response carries the updated LearningSession
    # so the frontend can drive CycleProgress without a fetch.
    assert "session" in body
    assert body["session"]["id"] == sess_id
    # The successful round-trip advanced cycle_step from the
    # /start default of 1 to 2.
    assert body["session"]["cycle_step"] == 2


def test_message_returns_ai_error_when_no_api_key(client: TestClient, mock_ai_plugin):
    """No key seeded -> route returns the user message + an
    ai_error explaining the gap. The mock plugin is registered
    but never reached because the route short-circuits before
    firing the hook."""
    _user_id, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Hello?"},
    )
    body = resp.json()
    assert body["user_message"]["content"] == "Hello?"
    assert body["assistant_message"] is None
    assert "No API key" in body["ai_error"]


def test_message_returns_ai_error_when_plugin_raises(
    client: TestClient, mock_ai_plugin
):
    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]

    mock_ai_plugin.raise_on_call = RuntimeError("provider down")

    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Will this fail gracefully?"},
    )
    body = resp.json()
    assert body["user_message"]["content"] == "Will this fail gracefully?"
    assert body["assistant_message"] is None
    assert "provider down" in body["ai_error"]


def test_message_returns_ai_error_when_no_provider_matches(client: TestClient):
    """No mock plugin registered + the production ai-anthropic
    plugin only handles claude-* models. Our default model maps
    map to claude-3-5-haiku-latest, which IS a claude-* prefix
    — so ai-anthropic WILL match and try the real SDK with our
    fake key. That hits a real network failure, which the
    route's exception handler catches and surfaces as an
    ai_error."""
    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Trigger the real SDK."},
    )
    body = resp.json()
    assert body["assistant_message"] is None
    assert body["ai_error"] is not None


def test_start_persists_system_prompt_as_first_session_message(client: TestClient):
    """v0.2.0 contract: /start saves the system prompt as the
    first SessionMessage so subsequent /message calls see it
    in chronological history without the frontend re-posting."""
    from app.models import SessionMessage
    from app.database import SessionLocal

    _, project_id = _make_user_and_project(client)
    out = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()
    sess_id = out["session"]["id"]
    prompt = out["system_prompt"]

    db = SessionLocal()
    try:
        rows = (
            db.query(SessionMessage)
            .filter(SessionMessage.session_id == sess_id)
            .all()
        )
        assert len(rows) == 1
        assert rows[0].role == "system"
        assert rows[0].content == prompt
    finally:
        db.close()


# --- v0.2.0: GET /switch-recommendation/{id} ------------------------------


def test_switch_recommendation_returns_false_on_no_history(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    resp = client.get(f"/api/plugins/session/switch-recommendation/{sess_id}")
    assert resp.status_code == 200
    body = resp.json()
    # No ratings yet: stagnation detector says no recommendation.
    assert body["recommended"] is False


def test_switch_recommendation_recommends_after_stagnant_ratings(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    # Three low-understanding / high-stress ratings -> stagnation
    # detected; switching.recommend returns a non-empty dict.
    for _ in range(3):
        client.post(
            f"/api/plugins/session/{sess_id}/rate",
            json={"understanding": 2, "stress": 5, "method_fit": 2},
        )
    resp = client.get(f"/api/plugins/session/switch-recommendation/{sess_id}")
    body = resp.json()
    assert body["recommended"] is True
    assert body["to_method"] is not None
    assert isinstance(body["reason"], str)


def test_switch_recommendation_404_on_unknown_session(client: TestClient):
    resp = client.get("/api/plugins/session/switch-recommendation/no-such")
    assert resp.status_code == 404


# --- v0.2.0: POST /{id}/switch -------------------------------------------


def test_switch_records_audit_row_and_updates_session(client: TestClient):
    """Accepting a method-switch suggestion records a MethodSwitch
    row (project-scoped audit) AND flips the session's method.
    The session stays active so the conversation continues with
    the new method on the next /message."""
    from app.database import SessionLocal
    from app.models import LearningSession, MethodSwitch

    _, project_id = _make_user_and_project(client)
    sess = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive"},
    ).json()["session"]
    assert sess["method"] == "deductive"

    resp = client.post(
        f"/api/plugins/session/{sess['id']}/switch",
        json={"to_method": "dialogic", "reason": "Stress too high."},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["method"] == "dialogic"
    assert body["status"] == "active"

    db = SessionLocal()
    try:
        # MethodSwitch row exists with the expected metadata.
        switches = (
            db.query(MethodSwitch)
            .filter(MethodSwitch.project_id == project_id)
            .all()
        )
        assert len(switches) == 1
        assert switches[0].from_method == "deductive"
        assert switches[0].to_method == "dialogic"
        assert switches[0].reason == "Stress too high."

        # Session row's method column was updated in place.
        sess_row = db.get(LearningSession, sess["id"])
        assert sess_row.method == "dialogic"
        assert sess_row.status == "active"
    finally:
        db.close()


def test_switch_is_idempotent_for_same_method(client: TestClient):
    """Re-accepting the current method writes NO MethodSwitch row
    (defensive guard against a double-click on the banner)."""
    from app.database import SessionLocal
    from app.models import MethodSwitch

    _, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive"},
    ).json()["session"]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/switch",
        json={"to_method": "deductive", "reason": "tap-tap"},
    )
    assert resp.status_code == 200
    assert resp.json()["method"] == "deductive"

    db = SessionLocal()
    try:
        switches = (
            db.query(MethodSwitch)
            .filter(MethodSwitch.project_id == project_id)
            .all()
        )
        assert len(switches) == 0
    finally:
        db.close()


def test_switch_rejects_on_closed_session(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    client.post(f"/api/plugins/session/{sess_id}/end")
    resp = client.post(
        f"/api/plugins/session/{sess_id}/switch",
        json={"to_method": "dialogic", "reason": "Late switch"},
    )
    assert resp.status_code == 400


def test_switch_404_on_unknown_session(client: TestClient):
    resp = client.post(
        "/api/plugins/session/no-such/switch",
        json={"to_method": "dialogic", "reason": "x"},
    )
    assert resp.status_code == 404


def test_switch_422_on_unknown_method(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/switch",
        json={"to_method": "telekinesis", "reason": "lol"},
    )
    assert resp.status_code == 422


# --- v0.4.0: Cycle-step advance through POST /message --------------------


def test_cycle_step_advances_on_successful_round_trip(
    client: TestClient, mock_ai_plugin
):
    """Each /message call that produces a successful AI reply
    bumps cycle_step by 1, persisted on the LearningSession row
    AND surfaced in the response's ``session`` field."""
    from app.database import SessionLocal
    from app.models import LearningSession

    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    mock_ai_plugin.reply = "Anything."

    # Fire three successful round-trips; cycle should walk 1 -> 4.
    for expected_step in (2, 3, 4):
        resp = client.post(
            f"/api/plugins/session/{sess_id}/message",
            json={"role": "user", "content": "Question."},
        )
        body = resp.json()
        assert body["session"]["cycle_step"] == expected_step

    # Verify persistence: DB row carries the same value as the
    # last response (no in-memory-only state).
    db = SessionLocal()
    try:
        row = db.get(LearningSession, sess_id)
        assert row.cycle_step == 4
    finally:
        db.close()


def test_cycle_step_caps_at_max(client: TestClient, mock_ai_plugin):
    """Step 7 is terminal — additional successful round-trips
    keep the session there (no wraparound to step 1)."""
    from app.database import SessionLocal
    from app.models import LearningSession

    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    # Start the session already at step 6 so one round-trip
    # walks it to 7, and a second round-trip should keep it at 7.
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "cycle_step": 6},
    ).json()["session"]["id"]
    mock_ai_plugin.reply = "AI reply."

    first = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "x"},
    ).json()
    assert first["session"]["cycle_step"] == 7
    second = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "y"},
    ).json()
    assert second["session"]["cycle_step"] == 7  # capped, not 8 or rolled to 1

    db = SessionLocal()
    try:
        assert db.get(LearningSession, sess_id).cycle_step == 7
    finally:
        db.close()


def test_cycle_step_does_not_advance_when_ai_errors_no_api_key(client: TestClient):
    """No API key configured -> ai_error is set, assistant_message
    is null, the user message is persisted, but cycle_step stays
    put. The 'failed turn' isn't real progress through the
    learning cycle."""
    _user_id, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "x"},
    )
    body = resp.json()
    assert body["assistant_message"] is None
    assert body["ai_error"] is not None
    assert body["session"]["cycle_step"] == 1  # unchanged


def test_cycle_step_does_not_advance_when_plugin_raises(
    client: TestClient, mock_ai_plugin
):
    """SDK / network exception path: route catches, returns the
    user message + ai_error, but does NOT advance cycle_step."""
    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    mock_ai_plugin.raise_on_call = RuntimeError("provider down")

    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "x"},
    )
    body = resp.json()
    assert body["assistant_message"] is None
    assert "provider down" in body["ai_error"]
    assert body["session"]["cycle_step"] == 1


def test_cycle_step_does_not_advance_for_non_user_role(client: TestClient):
    """role=assistant / role=system writes bypass the AI step;
    they also bypass the cycle-step advance. Pin against a
    future bug where external integrations that post raw
    assistant messages would silently progress the cycle."""
    _user_id, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "assistant", "content": "Out-of-band reply."},
    )
    body = resp.json()
    assert body["assistant_message"] is None
    assert body["ai_error"] is None
    assert body["session"]["cycle_step"] == 1  # unchanged
