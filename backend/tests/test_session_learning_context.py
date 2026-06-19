"""Integration (#797): a session started for a learner with lesson activity
carries that progress in its system prompt, so the AI is aware of completed
content, the lesson in progress, and the learner's recent mistakes.

Before this fix, ``POST /api/plugins/session/start`` built the system prompt
from the project + profile only — the AI had no idea which lessons were
done, what the learner was working on, or where they kept slipping, and even
claimed it "has no access to previous lessons".
"""

from __future__ import annotations

import json
import pathlib
from datetime import UTC, datetime

import pytest
from adaptive_learner_session.prompts import (
    CompletedLesson,
    InProgressLesson,
    LearningContext,
    RecentMistake,
    build_learning_context,
)
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import ElementError, LessonProgress

_FIXTURE_DIR = (
    pathlib.Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "learning-context-parity"
)


@pytest.fixture(name="client")
def _client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    user_id = client.post("/api/users", json={"name": "Learner"}).json()["id"]
    project_id = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "French A1",
            "goal": "Reach A1.",
            "timeframe": "2 weeks",
            "daily_minutes": 20,
        },
    ).json()["id"]
    return user_id, project_id


def _seed_progress(user_id: str) -> None:
    now = datetime.now(UTC)
    db = SessionLocal()
    try:
        db.add(
            LessonProgress(
                user_id=user_id,
                source="bundled:adaptive-learner-content",
                set_id="language-fr-a1",
                lesson_filename="01-greetings.json",
                status="completed",
                step_results="{}",
                score_correct=9,
                score_total=10,
                time_spent_seconds=120,
                started_at=now,
                updated_at=now,
                completed_at=now,
            )
        )
        db.add(
            LessonProgress(
                user_id=user_id,
                source="bundled:adaptive-learner-content",
                set_id="language-fr-a1",
                lesson_filename="02-numbers.json",
                status="in_progress",
                step_results="{}",
                score_correct=0,
                score_total=0,
                time_spent_seconds=30,
                current_step=2,
                started_at=now,
                updated_at=now,
            )
        )
        db.add(
            ElementError(
                user_id=user_id,
                set_id="language-fr-a1",
                lesson_id="01-greetings",
                exercise_id="ex1",
                element_key="bonjour",
                direction="target_to_source",
                element_type="vocab",
                user_answer="bonsoir",
                correct_answer="bonjour",
                error_count=3,
                correct_streak=0,
                last_attempt_at=now,
                last_error_at=now,
                mastered=False,
            )
        )
        db.commit()
    finally:
        db.close()


def _start(client: TestClient, project_id: str) -> str:
    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive", "cycle_step": 1, "lang": "en"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["system_prompt"]


def test_start_injects_learning_context(client: TestClient):
    user_id, project_id = _make_user_and_project(client)
    _seed_progress(user_id)

    prompt = _start(client, project_id)

    assert "LEARNING CONTEXT" in prompt
    assert "language-fr-a1 — 01 greetings (9/10)" in prompt
    assert "Currently working on: language-fr-a1 — 02 numbers, step 3" in prompt
    assert 'bonjour (answered "bonsoir", correct "bonjour", 3x)' in prompt
    assert 'You are a tutor for "French A1"' in prompt


def test_start_without_lesson_activity_has_no_learning_block(client: TestClient):
    _user_id, project_id = _make_user_and_project(client)
    # No LessonProgress / ElementError seeded.
    prompt = _start(client, project_id)
    assert "LEARNING CONTEXT" not in prompt


def test_build_learning_context_empty_returns_blank():
    assert build_learning_context(None, "en") == ""
    assert (
        build_learning_context(
            LearningContext(topic="X", completed=[], in_progress=None, mistakes=[]),
            "en",
        )
        == ""
    )


def test_caps_completed_at_12_and_mistakes_at_8():
    ctx = LearningContext(
        topic="T",
        completed=[CompletedLesson(f"l{i}", 1, 1) for i in range(20)],
        in_progress=None,
        mistakes=[RecentMistake(f"e{i}", "a", "b", 1) for i in range(20)],
    )
    out = build_learning_context(ctx, "en")
    assert "l11" in out and "l12" not in out
    assert "e7 " in out and "e8 " not in out


def _fixture_context() -> LearningContext:
    data = json.loads((_FIXTURE_DIR / "input.json").read_text(encoding="utf-8"))
    return LearningContext(
        topic=data["topic"],
        completed=[CompletedLesson(**c) for c in data["completed"]],
        in_progress=InProgressLesson(**data["in_progress"]) if data["in_progress"] else None,
        mistakes=[RecentMistake(**m) for m in data["mistakes"]],
    )


def test_parity_golden_en():
    expected = (_FIXTURE_DIR / "golden.en.txt").read_text(encoding="utf-8")
    assert build_learning_context(_fixture_context(), "en") == expected


def test_parity_golden_de():
    expected = (_FIXTURE_DIR / "golden.de.txt").read_text(encoding="utf-8")
    assert build_learning_context(_fixture_context(), "de") == expected
