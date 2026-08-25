"""Phase 3-D integration: tracking plugin under app.main.app.

Three contracts:

1. Closing a session via POST ``/api/plugins/session/{id}/end``
   automatically lands a ProgressCommit row (the session plugin
   fires ``on_session_complete``; the tracking plugin subscribes).
2. GET ``/api/plugins/tracking/commits/{project_id}`` returns the
   commit history.
3. GET ``/api/plugins/tracking/progress/{project_id}`` aggregates
   every ``get_progress_summary`` impl + namespaces the response
   so future analytics plugins can stack alongside without
   collision.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.openapi_metadata import iter_api_routes
from app.main import app, manager
from app.models import ProgressCommit


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "Tracker"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Tracking",
            "goal": "Watch progress.",
            "timeframe": "4 weeks",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _run_one_session(
    client: TestClient,
    project_id: str,
    *,
    method: str = "deductive",
    understanding: int = 4,
    stress: int = 2,
    notes: str | None = None,
) -> str:
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": method},
    ).json()["session"]["id"]
    rating_body: dict[str, object] = {
        "understanding": understanding,
        "stress": stress,
        "method_fit": 4,
    }
    if notes is not None:
        rating_body["notes"] = notes
    client.post(f"/api/plugins/session/{sess_id}/rate", json=rating_body)
    client.post(f"/api/plugins/session/{sess_id}/end")
    return sess_id


# --- Plugin wiring ---------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    active = {p.name for p in manager.get_active_plugins()}
    assert "tracking" in active


def test_router_exposes_two_paths(client: TestClient):
    paths = {r.path for r in iter_api_routes(app)}
    assert "/api/plugins/tracking/progress/{project_id}" in paths
    assert "/api/plugins/tracking/commits/{project_id}" in paths


# --- on_session_complete writes ProgressCommit ----------------------------


def test_session_close_writes_progress_commit(client: TestClient):
    _, project_id = _make_user_and_project(client)
    sess_id = _run_one_session(client, project_id)
    # Read the DB directly: the row must exist with the right ids
    # + the int-to-float rescaling applied.
    db = SessionLocal()
    try:
        rows = db.query(ProgressCommit).filter(ProgressCommit.project_id == project_id).all()
        assert len(rows) == 1
        row = rows[0]
        assert row.session_id == sess_id
        assert row.method == "deductive"
        assert row.understanding == pytest.approx(4 / 5)
        assert row.stress == pytest.approx(2 / 5)
        assert row.error_rate == 0.0
        assert row.duration_minutes >= 0
    finally:
        db.close()


def test_session_close_without_rating_skips_understanding(client: TestClient):
    """When no rating is posted, the session plugin's hook
    payload has an empty ``rating`` dict; the tracking plugin
    still writes the row but understanding / stress default to 0.
    """
    _, project_id = _make_user_and_project(client)
    sess_id = client.post("/api/plugins/session/start", json={"project_id": project_id}).json()[
        "session"
    ]["id"]
    client.post(f"/api/plugins/session/{sess_id}/end")  # no /rate call
    db = SessionLocal()
    try:
        rows = db.query(ProgressCommit).filter(ProgressCommit.project_id == project_id).all()
        assert len(rows) == 1
        assert rows[0].understanding == 0.0
        assert rows[0].stress == 0.0
    finally:
        db.close()


def test_multiple_sessions_produce_multiple_commits(client: TestClient):
    _, project_id = _make_user_and_project(client)
    for u in (2, 3, 4):
        _run_one_session(client, project_id, understanding=u)
    db = SessionLocal()
    try:
        rows = (
            db.query(ProgressCommit)
            .filter(ProgressCommit.project_id == project_id)
            .order_by(ProgressCommit.committed_at.asc())
            .all()
        )
        assert len(rows) == 3
        assert [round(r.understanding, 2) for r in rows] == [0.4, 0.6, 0.8]
    finally:
        db.close()


# --- GET /commits ---------------------------------------------------------


def test_get_commits_returns_history_ordered_oldest_first(client: TestClient):
    _, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, method="deductive", understanding=2)
    _run_one_session(client, project_id, method="dialogic", understanding=4)

    resp = client.get(f"/api/plugins/tracking/commits/{project_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["method"] == "deductive"
    assert body[1]["method"] == "dialogic"
    # ProgressCommitOut shape: every documented field is present.
    for key in (
        "id",
        "project_id",
        "session_id",
        "method",
        "understanding",
        "stress",
        "error_rate",
        "duration_minutes",
        "committed_at",
    ):
        assert key in body[0]


def test_get_commits_unknown_project_404(client: TestClient):
    resp = client.get("/api/plugins/tracking/commits/no-such")
    assert resp.status_code == 404


def test_get_commits_empty_when_no_sessions(client: TestClient):
    _, project_id = _make_user_and_project(client)
    resp = client.get(f"/api/plugins/tracking/commits/{project_id}")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_commits_includes_session_rating_notes(client: TestClient):
    """Phase 27B regression pin: the LEFT JOIN with SessionRating
    surfaces the rating's ``notes`` field on each commit response
    so the Progress page can render past notes as rich text.
    Sessions without a rating row yield ``notes: None``.
    """
    _, project_id = _make_user_and_project(client)
    # Session 1: legacy plain-text note.
    _run_one_session(client, project_id, notes="Took it slowly — bonus walk.")
    # Session 2: serialised TipTap JSON note (the Phase 27 shape).
    tiptap_json = (
        '{"type":"doc","content":[{"type":"paragraph",'
        '"content":[{"type":"text","text":"Felt focused."}]}]}'
    )
    _run_one_session(client, project_id, notes=tiptap_json)
    # Session 3: no notes (rating dialog left empty).
    _run_one_session(client, project_id)

    resp = client.get(f"/api/plugins/tracking/commits/{project_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    # Each row must expose the notes field (even if None) so the
    # frontend's TypeScript narrowing can rely on its presence.
    for row in body:
        assert "notes" in row
    # The first two carry their notes; the third is None.
    assert body[0]["notes"] == "Took it slowly — bonus walk."
    assert body[1]["notes"] == tiptap_json
    assert body[2]["notes"] is None


def test_get_commits_handles_session_without_rating_row(client: TestClient):
    """Sessions that ended without a /rate call (per
    ``test_session_close_without_rating_skips_understanding``)
    still produce a ProgressCommit. The LEFT JOIN must surface
    ``notes: None`` for those rows rather than dropping the
    commit entirely.
    """
    _, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start", json={"project_id": project_id}
    ).json()["session"]["id"]
    client.post(f"/api/plugins/session/{sess_id}/end")  # no /rate

    resp = client.get(f"/api/plugins/tracking/commits/{project_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["session_id"] == sess_id
    assert body[0]["notes"] is None


# --- GET /progress (summary aggregator) -----------------------------------


def test_get_progress_returns_tracking_namespace(client: TestClient):
    _, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, understanding=4, stress=2)
    _run_one_session(client, project_id, understanding=3, stress=3)
    resp = client.get(f"/api/plugins/tracking/progress/{project_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert "tracking" in body
    slice_ = body["tracking"]
    assert slice_["total_sessions"] == 2
    assert slice_["sessions_per_method"] == {"deductive": 2}
    assert slice_["recent_understanding"] == [0.8, 0.6]
    assert slice_["recent_stress"] == [0.4, 0.6]
    assert slice_["mean_understanding"] == pytest.approx(0.7)
    assert slice_["mean_stress"] == pytest.approx(0.5)


def test_get_progress_unknown_project_404(client: TestClient):
    resp = client.get("/api/plugins/tracking/progress/no-such")
    assert resp.status_code == 404


def test_get_progress_no_sessions_returns_empty_namespace(client: TestClient):
    _, project_id = _make_user_and_project(client)
    body = client.get(f"/api/plugins/tracking/progress/{project_id}").json()
    assert body["tracking"]["total_sessions"] == 0
    assert body["tracking"]["sessions_per_method"] == {}
    assert body["tracking"]["recent_understanding"] == []


# --- Phase 7B: new tracking fields ---------------------------------------


def test_get_progress_carries_v0_4_0_fields(client: TestClient):
    """v0.4.0 adds total_minutes, streak_days, method_distribution,
    recent_sessions on top of the v0.1.0 fields. Sanity-check
    that the live route surfaces all of them in the namespace
    slice."""
    _, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, understanding=4, stress=2)
    _run_one_session(client, project_id, understanding=3, stress=3)
    body = client.get(f"/api/plugins/tracking/progress/{project_id}").json()
    slice_ = body["tracking"]
    assert "total_minutes" in slice_
    assert "streak_days" in slice_
    assert "method_distribution" in slice_
    assert "recent_sessions" in slice_
    # method_distribution always emits one entry per method (6).
    assert len(slice_["method_distribution"]) == 6
    # recent_sessions newest-first, capped at 5.
    assert len(slice_["recent_sessions"]) == 2
    assert all(
        row["committed_at"] is not None for row in slice_["recent_sessions"]
    )


# --- Hook dispatch -------------------------------------------------------


def test_on_session_complete_hook_fires_tracking_subscriber(client: TestClient):
    """Sanity that the tracking plugin's subscription to
    on_session_complete is registered (the row-creation test
    above implicitly covers it but this isolates the wiring
    check by firing the hook directly with a known payload)."""
    _, project_id = _make_user_and_project(client)
    # Plant a real LearningSession row first — ProgressCommit.session_id
    # is a FK so the manual hook fire would IntegrityError otherwise.
    from app.models import LearningSession

    db = SessionLocal()
    try:
        sess = LearningSession(project_id=project_id, method="dialogic")
        db.add(sess)
        db.commit()
        db.refresh(sess)
        manual_sess_id = sess.id
    finally:
        db.close()

    # Direct hook fire — bypasses the session router so we observe
    # only the tracking plugin's subscriber.
    manager._pm.hook.on_session_complete(
        session={
            "id": manual_sess_id,
            "project_id": project_id,
            "method": "dialogic",
            "started_at": "2026-01-01T12:00:00+00:00",
            "ended_at": "2026-01-01T12:15:00+00:00",
            "status": "completed",
        },
        rating={"understanding": 5, "stress": 1, "method_fit": 5},
    )
    db = SessionLocal()
    try:
        rows = db.query(ProgressCommit).filter(ProgressCommit.project_id == project_id).all()
        assert len(rows) == 1
        assert rows[0].method == "dialogic"
        assert rows[0].duration_minutes == 15
        assert rows[0].understanding == 1.0
        assert rows[0].stress == 0.2
    finally:
        db.close()


def test_get_progress_summary_hook_dispatches(client: TestClient):
    """List-mode dispatch: every subscriber contributes its
    namespace slice. v1.16.0 added the gamification plugin as a
    second subscriber, so the result list now has two entries —
    one ``{tracking, step_evaluation}`` from tracking, one
    ``{gamification}`` from gamification. Order is whatever
    pluggy's hook-call dispatch settles on (subscriber-
    registration order, not a stable contract); the assertion
    finds the right slice in each result rather than relying on
    index 0."""
    _, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    results = manager._pm.hook.get_progress_summary(project_id=project_id)
    assert len(results) == 2
    tracking_slice = next(r for r in results if "tracking" in r)
    assert tracking_slice["tracking"]["total_sessions"] == 1
    gam_slice = next(r for r in results if "gamification" in r)
    assert gam_slice["gamification"]["total_xp"] > 0


# --- v0.5.0 / 8D step-evaluation namespace --------------------------------


def test_get_progress_includes_step_evaluation_namespace(client: TestClient):
    """The tracking plugin's get_progress_summary now returns
    BOTH ``tracking`` and ``step_evaluation`` namespaces. With no
    sessions yet, the step_evaluation slice is all-zeros."""
    _, project_id = _make_user_and_project(client)
    body = client.get(f"/api/plugins/tracking/progress/{project_id}").json()
    assert "step_evaluation" in body
    se = body["step_evaluation"]
    assert se["total_evaluations"] == 0
    assert se["average_confidence"] == 0.0
    assert se["advance_count"] == 0
    assert se["repeat_count"] == 0
    assert se["backward_count"] == 0
    assert se["fallback_count"] == 0
    assert se["evaluations_per_step"] == {}
    assert se["time_seconds_per_step"] == {}


def test_step_evaluation_aggregates_match_persisted_rows(client: TestClient):
    """Drop two StepEvaluation rows directly into the DB then hit
    the tracking route — the namespace should reflect both.
    Bypasses /message so we can control the exact rows without
    standing up a mocked AI provider."""
    from app.database import SessionLocal
    from app.models import LearningSession, StepEvaluation

    _, project_id = _make_user_and_project(client)
    # Plant one session under the project so the join in the
    # tracking plugin's query finds our evaluation rows.
    db = SessionLocal()
    try:
        sess = LearningSession(
            project_id=project_id,
            method="deductive",
            cycle_step=2,
            status="active",
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)
        db.add(
            StepEvaluation(
                session_id=sess.id,
                from_step=1,
                to_step=2,
                advance=True,
                confidence=0.9,
                applied=True,
                fallback_used=False,
                reason="Ready.",
            )
        )
        db.add(
            StepEvaluation(
                session_id=sess.id,
                from_step=2,
                to_step=2,
                advance=False,
                confidence=0.4,
                applied=False,
                fallback_used=False,
                reason="Not yet.",
            )
        )
        db.commit()
    finally:
        db.close()

    body = client.get(f"/api/plugins/tracking/progress/{project_id}").json()
    se = body["step_evaluation"]
    assert se["total_evaluations"] == 2
    # (0.9 + 0.4) / 2 = 0.65
    assert se["average_confidence"] == 0.65
    assert se["advance_count"] == 1  # the 1→2 row
    assert se["repeat_count"] == 1  # the applied=False row
    # JSON over the wire stringifies integer dict keys.
    assert se["evaluations_per_step"] == {"1": 1, "2": 1}


def test_step_evaluation_namespace_scopes_to_project(client: TestClient):
    """Two projects each have their own sessions + evaluations.
    The /progress/{project_id} endpoint must NOT bleed evaluations
    across projects — pinned by writing rows to project B's
    session and asserting project A's response stays empty."""
    from app.database import SessionLocal
    from app.models import LearningSession, StepEvaluation

    user_id, project_a = _make_user_and_project(client)
    # Create a second project for the same user.
    project_b = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Other topic",
            "goal": "Other goal.",
            "timeframe": "1 week",
            "daily_minutes": 30,
        },
    ).json()["id"]

    db = SessionLocal()
    try:
        # Session + evaluation on project B only.
        sess_b = LearningSession(
            project_id=project_b,
            method="dialogic",
            cycle_step=3,
            status="active",
        )
        db.add(sess_b)
        db.commit()
        db.refresh(sess_b)
        db.add(
            StepEvaluation(
                session_id=sess_b.id,
                from_step=2,
                to_step=3,
                advance=True,
                confidence=0.85,
                applied=True,
                fallback_used=False,
                reason="ok",
            )
        )
        db.commit()
    finally:
        db.close()

    # Project A: still zero evaluations.
    body_a = client.get(f"/api/plugins/tracking/progress/{project_a}").json()
    assert body_a["step_evaluation"]["total_evaluations"] == 0
    # Project B: sees its own evaluation.
    body_b = client.get(f"/api/plugins/tracking/progress/{project_b}").json()
    assert body_b["step_evaluation"]["total_evaluations"] == 1
