"""LessonProgress <-> LearningSession unification pins
(Phase 46F / v1.31.0 / P-129).

Covers:

- Lazy pseudo-project creation: first lesson completion
  creates the ``kind="content"`` project; subsequent
  completions reuse it.
- ``LearningSession`` row shape: ``method="content"``,
  ``status="completed"``, parent kind is "content".
- End-to-end via TestClient: hitting ``POST
  /api/users/{id}/lesson-progress`` with
  ``mark_completed=True`` writes both LessonProgress (status
  flip) AND LearningSession, and the gamification plugin's
  ``on_session_complete`` handler creates a UserXP row as a
  side effect (the exact XP value is 46E.1's concern).

Tests use ``TestClient(app)`` rather than a bare
SessionLocal so the FastAPI lifespan fires plugin discovery
+ hook wiring. Otherwise the ``_fire_on_session_complete``
path would no-op silently.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import (
    LEARNING_PROJECT_KIND_CONTENT,
    LearningProject,
    LearningSession,
    User,
    UserXP,
)
from app.services.lesson_session_unification import (
    CONTENT_LESSON_METHOD,
    find_or_create_content_pseudo_project,
    record_lesson_completion_session,
)


@pytest.fixture()
def client():
    """TestClient with lifespan so plugin manager + hook
    dispatch is live (the gamification plugin's
    on_session_complete handler is the integration
    boundary we want to exercise)."""
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient, *, name: str = "Tester") -> str:
    response = client.post(
        "/api/users",
        json={"name": name, "language": "en"},
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


SOURCE = "astrapi69/adaptive-learner-content"
SET_ID = "language-fr-a1"
LESSON_A = "01-greetings.json"
LESSON_B = "02-numbers.json"


# --- Pseudo-project lifecycle (lazy + idempotent, D1) ----------------------


def test_find_or_create_pseudo_project_creates_on_first_call(client: TestClient):
    """No content project exists until the helper is invoked."""
    user_id = _make_user(client, name="Lazy-A")
    db = SessionLocal()
    try:
        existing = (
            db.query(LearningProject)
            .filter(
                LearningProject.user_id == user_id,
                LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT,
            )
            .count()
        )
        assert existing == 0

        proj = find_or_create_content_pseudo_project(db, user_id)
        db.commit()

        assert proj.user_id == user_id
        assert proj.kind == LEARNING_PROJECT_KIND_CONTENT
        assert proj.topic == "Content Lessons"
        assert proj.active is True
    finally:
        db.close()


def test_find_or_create_pseudo_project_is_idempotent(client: TestClient):
    """Repeated calls return the same row — no duplicates."""
    user_id = _make_user(client, name="Lazy-B")
    db = SessionLocal()
    try:
        first = find_or_create_content_pseudo_project(db, user_id)
        db.commit()
        second = find_or_create_content_pseudo_project(db, user_id)
        db.commit()

        assert first.id == second.id

        count = (
            db.query(LearningProject)
            .filter(
                LearningProject.user_id == user_id,
                LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT,
            )
            .count()
        )
        assert count == 1
    finally:
        db.close()


def test_pseudo_project_isolated_per_user(client: TestClient):
    """Two users get two pseudo-projects, not one shared."""
    user_a = _make_user(client, name="Lazy-C")
    user_b = _make_user(client, name="Lazy-D")
    db = SessionLocal()
    try:
        proj_a = find_or_create_content_pseudo_project(db, user_a)
        proj_b = find_or_create_content_pseudo_project(db, user_b)
        db.commit()
        assert proj_a.id != proj_b.id
        assert proj_a.user_id == user_a
        assert proj_b.user_id == user_b
    finally:
        db.close()


# --- LearningSession write (D2: method="content") -------------------------


def test_record_session_creates_session_against_pseudo_project(
    client: TestClient,
):
    user_id = _make_user(client, name="Sess-A")
    db = SessionLocal()
    try:
        sess = record_lesson_completion_session(
            db,
            user_id=user_id,
            lesson_progress_id="lp-fake-1",
            score_correct=8,
            score_total=10,
        )

        assert sess.method == CONTENT_LESSON_METHOD == "content"
        assert sess.status == "completed"
        assert sess.cycle_step == 1
        assert sess.ended_at is not None
        assert sess.project.kind == LEARNING_PROJECT_KIND_CONTENT
        assert sess.project.user_id == user_id
    finally:
        db.close()


def test_record_session_twice_reuses_pseudo_project(client: TestClient):
    """Two completions = two sessions on the SAME pseudo-project."""
    user_id = _make_user(client, name="Sess-B")
    db = SessionLocal()
    try:
        s1 = record_lesson_completion_session(
            db,
            user_id=user_id,
            lesson_progress_id="lp-1",
            score_correct=4,
            score_total=4,
        )
        s2 = record_lesson_completion_session(
            db,
            user_id=user_id,
            lesson_progress_id="lp-2",
            score_correct=3,
            score_total=4,
        )

        assert s1.id != s2.id
        assert s1.project_id == s2.project_id

        projects = (
            db.query(LearningProject)
            .filter(
                LearningProject.user_id == user_id,
                LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT,
            )
            .count()
        )
        assert projects == 1
    finally:
        db.close()


# --- End-to-end via the lesson_progress upsert endpoint -------------------


def _post_step(client: TestClient, user_id: str, lesson: str):
    return client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": lesson,
            "step_result": {
                "step_id": "ex-1",
                "correct": 4,
                "total": 4,
            },
        },
    )


def _post_complete(client: TestClient, user_id: str, lesson: str):
    return client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": lesson,
            "mark_completed": True,
        },
    )


def test_mark_completed_writes_learning_session(client: TestClient):
    """Hitting the upsert endpoint with mark_completed=True
    triggers the unification: LearningSession is written
    against the pseudo-project."""
    user_id = _make_user(client, name="E2E-A")

    step = _post_step(client, user_id, LESSON_A)
    assert step.status_code == 200

    complete = _post_complete(client, user_id, LESSON_A)
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"

    db = SessionLocal()
    try:
        sessions = (
            db.query(LearningSession)
            .join(LearningProject, LearningSession.project_id == LearningProject.id)
            .filter(LearningProject.user_id == user_id)
            .filter(LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT)
            .all()
        )
        assert len(sessions) == 1
        assert sessions[0].method == "content"
        assert sessions[0].status == "completed"
    finally:
        db.close()


def test_mark_completed_idempotent_second_call_no_extra_session(
    client: TestClient,
):
    """Re-posting mark_completed=True on an already-completed
    row must NOT write a duplicate LearningSession."""
    user_id = _make_user(client, name="E2E-B")
    _post_step(client, user_id, LESSON_A)
    _post_complete(client, user_id, LESSON_A)
    _post_complete(client, user_id, LESSON_A)  # second flip is a no-op

    db = SessionLocal()
    try:
        count = (
            db.query(LearningSession)
            .join(LearningProject, LearningSession.project_id == LearningProject.id)
            .filter(LearningProject.user_id == user_id)
            .filter(LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT)
            .count()
        )
        assert count == 1
    finally:
        db.close()


def test_mark_completed_two_different_lessons_two_sessions(
    client: TestClient,
):
    """Completing two distinct lessons produces two
    LearningSession rows on the same pseudo-project."""
    user_id = _make_user(client, name="E2E-C")
    _post_step(client, user_id, LESSON_A)
    _post_complete(client, user_id, LESSON_A)
    _post_step(client, user_id, LESSON_B)
    _post_complete(client, user_id, LESSON_B)

    db = SessionLocal()
    try:
        sessions = (
            db.query(LearningSession)
            .join(LearningProject, LearningSession.project_id == LearningProject.id)
            .filter(LearningProject.user_id == user_id)
            .filter(LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT)
            .all()
        )
        assert len(sessions) == 2

        projects = (
            db.query(LearningProject)
            .filter(LearningProject.user_id == user_id)
            .filter(LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT)
            .count()
        )
        assert projects == 1
    finally:
        db.close()


def test_mark_completed_triggers_gamification_xp_award(client: TestClient):
    """The on_session_complete hook fires and the
    gamification plugin's handler writes a UserXP row.

    The exact XP value is NOT pinned here — that's 46E.1's
    concern. This test only verifies the plumbing (hook
    fires, gamification handler runs, UserXP exists).
    """
    user_id = _make_user(client, name="E2E-D")
    _post_step(client, user_id, LESSON_A)
    _post_complete(client, user_id, LESSON_A)

    db = SessionLocal()
    try:
        xp = db.query(UserXP).filter(UserXP.user_id == user_id).one_or_none()
        assert xp is not None, (
            "UserXP row missing — on_session_complete hook did not fire "
            "or gamification plugin handler crashed"
        )
        assert xp.total_xp > 0
    finally:
        db.close()


def test_pseudo_project_not_listed_under_user_via_existing_route(
    client: TestClient,
):
    """Sanity: even though the pseudo-project gets created,
    it still appears under the user's project list at the
    backend level. The 46F.3 frontend filter is the layer
    that hides it from the UI; this test pins the current
    backend behaviour so 46F.3 has a known starting point.
    """
    user_id = _make_user(client, name="E2E-E")
    _post_step(client, user_id, LESSON_A)
    _post_complete(client, user_id, LESSON_A)

    r = client.get(f"/api/users/{user_id}/projects")
    assert r.status_code == 200
    projects = r.json()
    # The backend currently returns the pseudo-project too;
    # the frontend filters by kind. Confirm the kind is
    # exposed in the response so the filter has data.
    kinds = [p["kind"] for p in projects]
    assert "content" in kinds


def test_no_pseudo_project_when_no_lesson_completed(client: TestClient):
    """Lazy creation (D1): a user with only a step-update
    (no completion) gets NO pseudo-project."""
    user_id = _make_user(client, name="Lazy-E")
    _post_step(client, user_id, LESSON_A)
    # Don't post mark_completed.

    db = SessionLocal()
    try:
        count = (
            db.query(LearningProject)
            .filter(LearningProject.user_id == user_id)
            .filter(LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT)
            .count()
        )
        assert count == 0
    finally:
        db.close()
