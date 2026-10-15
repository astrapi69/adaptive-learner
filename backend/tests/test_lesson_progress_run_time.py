"""The time of the current run, apart from the lifetime total (#3747).

``time_spent_seconds`` sums every visit of a lesson, across restarts, and
statistics and missions add it up as study time. The summary showed it as
the time of the run just finished, so a restarted lesson reported 35 or
134 minutes for a few minutes' run. ``run_time_seconds`` counts the
current run only: it grows with the same deltas and starts over on a
restart and on an abandon, while the lifetime total keeps growing.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.services.backup_service import create_backup, restore_backup

SOURCE = "astrapi69/adaptive-learner-content"
SET_ID = "language-fr-a1"
LESSON = "01-greetings.json"


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient) -> str:
    response = client.post("/api/users", json={"name": "Tester", "language": "en"})
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def _upsert(client: TestClient, user_id: str, **extra: Any) -> dict[str, Any]:
    response = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={"source": SOURCE, "set_id": SET_ID, "lesson_filename": LESSON, **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_fresh_row_has_no_run_time(client: TestClient) -> None:
    user_id = _make_user(client)
    body = _upsert(client, user_id)
    assert body["run_time_seconds"] == 0
    assert body["time_spent_seconds"] == 0


def test_a_delta_counts_for_the_run_and_the_lifetime(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, time_spent_seconds_delta=40)
    body = _upsert(client, user_id, time_spent_seconds_delta=20)
    assert (body["run_time_seconds"], body["time_spent_seconds"]) == (60, 60)


@pytest.mark.parametrize("flag", ["mark_restarted", "mark_abandoned"], ids=["restart", "abandon"])
def test_a_new_run_starts_at_zero_and_the_lifetime_keeps_growing(
    client: TestClient, flag: str
) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, time_spent_seconds_delta=2100)
    reset = _upsert(client, user_id, **{flag: True})
    assert (reset["run_time_seconds"], reset["time_spent_seconds"]) == (0, 2100)

    if flag == "mark_abandoned":
        _upsert(client, user_id, mark_restarted=True)
    body = _upsert(client, user_id, time_spent_seconds_delta=180)
    assert (body["run_time_seconds"], body["time_spent_seconds"]) == (180, 2280)


def test_pause_and_resume_keep_the_run_time(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, time_spent_seconds_delta=90)
    _upsert(client, user_id, mark_paused=True)
    body = _upsert(client, user_id, mark_resumed=True, time_spent_seconds_delta=30)
    assert (body["run_time_seconds"], body["time_spent_seconds"]) == (120, 120)


def _backup_round_trip(client: TestClient, user_id: str, edit) -> dict[str, Any]:
    db = SessionLocal()
    try:
        backup = create_backup(SqlAlchemyBackupRepository(db), user_id)
        record = backup["data"]["lesson_progress"][0]
        edit(record)
        record["updated_at"] = "2099-01-01T00:00:00+00:00"
        result = restore_backup(SqlAlchemyBackupRepository(db), backup)
        assert result["errors"] == []
    finally:
        db.close()
    return client.get(f"/api/users/{user_id}/lesson-progress").json()[0]


def test_backup_carries_the_run_time(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, time_spent_seconds_delta=600)
    _upsert(client, user_id, mark_restarted=True)
    _upsert(client, user_id, time_spent_seconds_delta=45)

    def check(record: dict[str, Any]) -> None:
        assert record["run_time_seconds"] == 45
        record["run_time_seconds"] = 50

    row = _backup_round_trip(client, user_id, check)
    assert (row["run_time_seconds"], row["time_spent_seconds"]) == (50, 645)


def test_a_backup_from_before_the_field_restores_the_lifetime_total(client: TestClient) -> None:
    from app.models import LessonProgress

    user_id = _make_user(client)
    _upsert(client, user_id, time_spent_seconds_delta=300)
    db = SessionLocal()
    try:
        backup = create_backup(SqlAlchemyBackupRepository(db), user_id)
        # Restore into a profile without the row, as on a fresh device.
        db.query(LessonProgress).filter(LessonProgress.user_id == user_id).delete()
        db.commit()
        record = backup["data"]["lesson_progress"][0]
        record.pop("run_time_seconds")
        result = restore_backup(SqlAlchemyBackupRepository(db), backup)
        assert result["errors"] == []
    finally:
        db.close()
    row = client.get(f"/api/users/{user_id}/lesson-progress").json()[0]
    assert (row["run_time_seconds"], row["time_spent_seconds"]) == (300, 300)


def test_the_migration_backfills_the_lifetime_total(tmp_path) -> None:
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, inspect, text

    backend = Path(__file__).resolve().parent.parent
    url = f"sqlite:///{tmp_path / 'run-time.db'}"
    cfg = Config(str(backend / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "0040_xp_purchases")

    engine = create_engine(url)
    columns = inspect(engine).get_columns("lesson_progress")
    values: dict[str, Any] = {}
    for column in columns:
        if column["nullable"] or column.get("default") is not None:
            continue
        kind = str(column["type"]).upper()
        values[column["name"]] = (
            0 if "INT" in kind else "2026-01-01 00:00:00" if "DATE" in kind else "x"
        )
    values.update(id="row-1", time_spent_seconds=2100, step_results="{}")
    names = ", ".join(values)
    marks = ", ".join(f":{name}" for name in values)
    with engine.begin() as conn:
        conn.execute(text(f"INSERT INTO lesson_progress ({names}) VALUES ({marks})"), values)

    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        run = conn.execute(text("SELECT run_time_seconds FROM lesson_progress")).scalar_one()
    engine.dispose()
    assert run == 2100
