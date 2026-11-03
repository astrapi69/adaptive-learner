"""Merging two lesson_progress rows on restore (#3787), API-mode half.

The cases are shared with the browser half
(``frontend/src/storage/lessons/progress-merge.test.ts``) through
``tests/fixtures/progress-merge-parity/cases.json``, so both restores apply one
rule: a completion is never lost, a deliberate restart on the device that saw
that completion stays, two runs keep the furthest step.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.models import LessonProgress, User
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.services.backup_export import BACKUP_FORMAT, BACKUP_VERSION
from app.services.backup_restore import restore_backup
from app.services.progress_merge import merge_lesson_progress

CASES_FILE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "fixtures"
    / "progress-merge-parity"
    / "cases.json"
)
CASES: list[dict[str, Any]] = json.loads(CASES_FILE.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_a_shared_case_merges_as_written(case: dict[str, Any]) -> None:
    merged, changed = merge_lesson_progress(case["local"], case["backup"])
    expected = dict(case["expected"])
    assert changed is expected.pop("changed")
    assert {field: merged.get(field) for field in expected} == expected


def test_the_shared_cases_are_read() -> None:
    assert len(CASES) >= 10


# ---- Through the restore (the API-mode path) --------------------------------


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Direct SQLAlchemy session bound to the in-memory test DB."""
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _progress(db: Session, user_id: str, *, row_id: str) -> LessonProgress:
    row = LessonProgress(
        id=row_id,
        user_id=user_id,
        source="astrapi69/adaptive-learner-content",
        set_id="fr-a1",
        lesson_filename="01-intro.json",
        status="in_progress",
        current_step=1,
        step_results="{}",
    )
    db.add(row)
    db.commit()
    return row


def _backup_with(user_id: str, row_id: str, **fields: Any) -> dict[str, Any]:
    row = {
        "id": row_id,
        "user_id": user_id,
        "source": "astrapi69/adaptive-learner-content",
        "set_id": "fr-a1",
        "lesson_filename": "01-intro.json",
        "status": "completed",
        "attempts": 1,
        "attempt_history": json.dumps(
            [{"at": "2026-10-01T10:00:00+00:00", "correct": 8, "total": 10}]
        ),
        "best_score_correct": 8,
        "best_score_total": 10,
        "score_correct": 8,
        "score_total": 10,
        "current_step": 0,
        "step_results": "{}",
        "completed_at": "2026-10-01T10:00:00+00:00",
        "started_at": "2026-10-01T09:50:00+00:00",
        "updated_at": "2026-10-01T10:00:00+00:00",
        **fields,
    }
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "user_id": user_id,
        "storage_mode": "dexie",
        "data": {"lesson_progress": [row]},
    }


@pytest.mark.parametrize(
    "backup_id", ["same-id", "other-device-id"], ids=["by-id", "by-unique-key"]
)
def test_restore_keeps_a_completion_against_a_newer_opened_row(
    db_session: Session, backup_id: str
) -> None:
    user = User(name="Aster", email=None, language="de")
    db_session.add(user)
    db_session.commit()
    _progress(db_session, user.id, row_id="same-id")

    summary = restore_backup(
        SqlAlchemyBackupRepository(db_session), _backup_with(user.id, backup_id)
    )

    assert summary["tables"]["lesson_progress"]["updated"] == 1
    db_session.expire_all()
    rows = db_session.query(LessonProgress).all()
    assert [(row.id, row.status, row.attempts, row.best_score_correct) for row in rows] == [
        ("same-id", "completed", 1, 8)
    ]
