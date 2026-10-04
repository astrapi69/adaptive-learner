"""Every model column survives export -> wipe -> import (#3363).

The backup and LAN-sync wire shape is the ``TableSpec.columns`` allowlist
in ``sync_tables``. Eight columns added after their table's spec were
never declared, so export, restore and sync dropped them in silence:
``lesson_progress.paused_at`` / ``abandoned_at``,
``imported_conversations.content_hash`` / ``source_language`` /
``target_language``, ``learning_sessions.cycle_count`` /
``cycle_topics`` and ``session_notes.kind``.

The rows are written by their producers where one exists as an endpoint
(the lesson-progress pause), otherwise through the model itself, which is
the shape the producer stores.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import (
    ImportedConversation,
    LearningProject,
    LearningSession,
    LessonProgress,
    SessionNote,
    User,
)
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.services.backup_service import create_backup, restore_backup

ABANDONED_AT = datetime(2026, 9, 1, 8, 0, tzinfo=UTC)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def _seed(client: TestClient) -> str:
    """One row per affected table, carrying a non-default value in each
    previously dropped column. Returns the user id."""
    user_id = client.post("/api/users", json={"name": "Columns", "language": "de"}).json()["id"]
    paused = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": "jane/repo",
            "set_id": "es-a1",
            "lesson_filename": "01.json",
            "current_step": 4,
            "mark_paused": True,
            # #3365 - the action log rides the backup like any column.
            "step_event": {"kind": "pause", "step_index": 4, "step_id": "s4"},
        },
    )
    assert paused.status_code == 200, paused.text
    assert paused.json()["paused_at"] is not None

    db = SessionLocal()
    try:
        db.add(
            LessonProgress(
                user_id=user_id,
                source="jane/repo",
                set_id="es-a1",
                lesson_filename="02.json",
                status="abandoned",
                abandoned_at=ABANDONED_AT,
            )
        )
        project = LearningProject(
            user_id=user_id, topic="Bayes", goal="Master it", timeframe="2 weeks", daily_minutes=30
        )
        db.add(project)
        db.flush()
        session = LearningSession(
            project_id=project.id,
            method="deductive",
            cycle_count=3,
            cycle_topics=json.dumps(["priors", "likelihood"]),
        )
        db.add(session)
        db.flush()
        db.add(SessionNote(session_id=session.id, content="why it works", kind="meta_learning"))
        db.add(
            ImportedConversation(
                user_id=user_id,
                title="Chat",
                source="chatgpt",
                content_hash="sha256-abc",
                source_language="de",
                target_language="es",
            )
        )
        db.commit()
    finally:
        db.close()
    return user_id


def _snapshot(user_id: str) -> dict[str, object]:
    """The previously dropped values, read back from the database."""
    db = SessionLocal()
    try:
        progress = {
            row.lesson_filename: row
            for row in db.query(LessonProgress).filter(LessonProgress.user_id == user_id)
        }
        session = (
            db.query(LearningSession)
            .join(LearningProject)
            .filter(LearningProject.user_id == user_id)
            .one()
        )
        note = db.query(SessionNote).filter(SessionNote.session_id == session.id).one()
        chat = db.query(ImportedConversation).filter(ImportedConversation.user_id == user_id).one()
        paused_at = progress["01.json"].paused_at
        abandoned_at = progress["02.json"].abandoned_at
        return {
            "lesson_progress.paused_at": paused_at.replace(tzinfo=UTC) if paused_at else None,
            "lesson_progress.abandoned_at": abandoned_at.replace(tzinfo=UTC)
            if abandoned_at
            else None,
            "lesson_progress.recent_steps": json.loads(progress["01.json"].recent_steps)
            or None,
            "learning_sessions.cycle_count": session.cycle_count,
            "learning_sessions.cycle_topics": json.loads(session.cycle_topics or "null"),
            "session_notes.kind": note.kind,
            "imported_conversations.content_hash": chat.content_hash,
            "imported_conversations.source_language": chat.source_language,
            "imported_conversations.target_language": chat.target_language,
        }
    finally:
        db.close()


def test_every_previously_dropped_column_survives_export_wipe_import(client):
    user_id = _seed(client)
    before = _snapshot(user_id)
    assert all(value is not None for value in before.values()), before

    db = SessionLocal()
    try:
        backup = create_backup(SqlAlchemyBackupRepository(db), user_id)
        db.delete(db.get(User, user_id))
        db.commit()
        result = restore_backup(SqlAlchemyBackupRepository(db), backup)
        assert result["errors"] == []
    finally:
        db.close()

    after = _snapshot(user_id)
    lost = {key: (before[key], after[key]) for key in before if before[key] != after[key]}
    assert lost == {}
