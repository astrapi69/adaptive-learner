"""Durchgang (run/pass) tests — API-mode half of EXP-051 / #2125.

Pins the SetRun model + service + the ``run_id`` scoping on the
element-error read paths:

  - a set with no ``set_runs`` row reads as the implicit active run 1
    (backward-compatible, no backfill);
  - recording an attempt lazily materialises the active run;
  - starting a new run closes the old and opens the next atomically,
    without touching the old run's frozen ``element_errors`` rows;
  - the default (active-run) read scope excludes a closed run's rows,
    while ``run_id=N`` reads exactly that run (the Fehlerhistorie path);
  - the review queue only sees the active run;
  - deleting a set sweeps ALL of its runs.

Uses ``TestClient`` to fire the lifespan (init_db + migration head)
then talks to the services via ``SessionLocal`` directly.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.repositories.element_errors_repo import SqlAlchemyElementErrorsRepository
from app.repositories.set_runs_repo import SqlAlchemySetRunsRepository
from app.schemas import ElementAttemptIn
from app.services import element_errors as ee_service
from app.services import element_srs as srs_service
from app.services import set_runs as run_service

SET = "language-fr-a1"


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user_id(client: TestClient) -> str:
    r = client.post("/api/users", json={"name": "Run-Test", "language": "en"})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _attempt(*, element_key: str = "merci", correct: bool = False) -> ElementAttemptIn:
    return ElementAttemptIn(
        set_id=SET,
        lesson_id="01-greetings.json",
        exercise_id="ex-thanks",
        element_key=element_key,
        correct=correct,
        correct_answer="Merci",
    )


def _record(db, user_id: str, attempts: list[ElementAttemptIn]) -> None:
    ee_repo = SqlAlchemyElementErrorsRepository(db)
    sr_repo = SqlAlchemySetRunsRepository(db)
    ee_service.record_attempts(ee_repo, user_id, attempts, set_runs_repo=sr_repo)
    ee_repo.commit()


# --- lazy run 1 + recording -------------------------------------------------


def test_recording_lazily_materialises_run_1(user_id: str) -> None:
    db = SessionLocal()
    try:
        _record(db, user_id, [_attempt(correct=False)])
        sr_repo = SqlAlchemySetRunsRepository(db)
        active = sr_repo.get_active(user_id, SET)
        assert active is not None
        assert active.run_id == 1
        assert active.closed_at is None
        # The element-error row carries run_id 1.
        rows = ee_service.list_for_user(
            SqlAlchemyElementErrorsRepository(db), user_id
        )
        assert len(rows) == 1
        assert rows[0].run_id == 1
    finally:
        db.close()


def test_ensure_active_run_returns_existing_open_run(user_id: str) -> None:
    db = SessionLocal()
    try:
        sr_repo = SqlAlchemySetRunsRepository(db)
        first = run_service.ensure_active_run(sr_repo, user_id, SET)
        second = run_service.ensure_active_run(sr_repo, user_id, SET)
        sr_repo.commit()
        assert first == second == 1
        assert len(sr_repo.list_for_set(user_id, SET)) == 1
    finally:
        db.close()


# --- starting a new run -----------------------------------------------------


def test_start_new_run_closes_old_opens_next(user_id: str) -> None:
    db = SessionLocal()
    try:
        _record(db, user_id, [_attempt(correct=False)])  # opens run 1
        sr_repo = SqlAlchemySetRunsRepository(db)
        new_run = run_service.start_new_run(sr_repo, user_id, SET)
        assert new_run.run_id == 2
        assert new_run.closed_at is None
        runs = sr_repo.list_for_set(user_id, SET)
        assert [r.run_id for r in runs] == [1, 2]
        assert runs[0].closed_at is not None  # run 1 now closed
        assert runs[1].closed_at is None  # run 2 active
    finally:
        db.close()


def test_start_new_run_with_no_prior_run_row(user_id: str) -> None:
    """A set that was never recorded still opens run 2 (run 1 materialised
    as closed) — the legacy-import / restart-immediately path."""
    db = SessionLocal()
    try:
        sr_repo = SqlAlchemySetRunsRepository(db)
        new_run = run_service.start_new_run(sr_repo, user_id, SET)
        assert new_run.run_id == 2
        runs = sr_repo.list_for_set(user_id, SET)
        assert [r.run_id for r in runs] == [1, 2]
        assert runs[0].closed_at is not None
    finally:
        db.close()


def test_second_run_does_not_overwrite_first(user_id: str) -> None:
    db = SessionLocal()
    try:
        # Run 1: one wrong answer on "merci".
        _record(db, user_id, [_attempt(element_key="merci", correct=False)])
        # Start run 2, answer "merci" correctly.
        run_service.start_new_run(SqlAlchemySetRunsRepository(db), user_id, SET)
        _record(db, user_id, [_attempt(element_key="merci", correct=True)])

        ee_repo = SqlAlchemyElementErrorsRepository(db)
        run1 = ee_service.list_for_user(ee_repo, user_id, run_id=1)
        run2 = ee_service.list_for_user(ee_repo, user_id, run_id=2)
        assert len(run1) == 1 and run1[0].error_count == 1
        assert len(run2) == 1 and run2[0].error_count == 0
        assert run1[0].id != run2[0].id  # two distinct rows, history kept
    finally:
        db.close()


# --- read scoping -----------------------------------------------------------


def test_default_list_scopes_to_active_run(user_id: str) -> None:
    db = SessionLocal()
    try:
        _record(db, user_id, [_attempt(correct=False)])  # run 1
        run_service.start_new_run(SqlAlchemySetRunsRepository(db), user_id, SET)
        _record(db, user_id, [_attempt(correct=True)])  # run 2

        ee_repo = SqlAlchemyElementErrorsRepository(db)
        active = ee_service.list_for_user(ee_repo, user_id)  # default = active
        assert len(active) == 1
        assert active[0].run_id == 2
        # An explicit run_id reaches the closed run.
        assert len(ee_service.list_for_user(ee_repo, user_id, run_id=1)) == 1
    finally:
        db.close()


def test_review_queue_only_sees_active_run(user_id: str) -> None:
    db = SessionLocal()
    try:
        _record(db, user_id, [_attempt(element_key="a", correct=False)])  # run 1
        run_service.start_new_run(SqlAlchemySetRunsRepository(db), user_id, SET)
        _record(db, user_id, [_attempt(element_key="b", correct=False)])  # run 2

        ee_repo = SqlAlchemyElementErrorsRepository(db)
        queue = srs_service.compute_review_queue(ee_repo, user_id, set_id=SET)
        keys = {item.element_key for item in queue}
        assert keys == {"b"}  # run-1 "a" is frozen, out of the queue
    finally:
        db.close()


def test_legacy_rows_without_set_runs_read_as_active(user_id: str) -> None:
    """Direct ``record_attempt`` (no set_runs repo) writes run 1 and, with no
    ``set_runs`` row, reads as the active run — the pre-EXP-051 shape."""
    db = SessionLocal()
    try:
        ee_repo = SqlAlchemyElementErrorsRepository(db)
        ee_service.record_attempt(ee_repo, user_id, _attempt(correct=False))
        ee_repo.commit()
        assert SqlAlchemySetRunsRepository(db).get_active(user_id, SET) is None
        assert len(ee_service.list_for_user(ee_repo, user_id)) == 1
    finally:
        db.close()


# --- endpoints --------------------------------------------------------------


def test_start_and_list_run_endpoints(client: TestClient, user_id: str) -> None:
    # No runs yet.
    r = client.get(f"/api/users/{user_id}/set-runs", params={"set_id": SET})
    assert r.status_code == 200, r.text
    assert r.json() == []

    # Start a run.
    r = client.post(f"/api/users/{user_id}/set-runs", json={"set_id": SET})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["run_id"] == 2  # materialised run 1 closed + opened run 2
    assert body["closed_at"] is None

    # Listing now shows both runs.
    r = client.get(f"/api/users/{user_id}/set-runs", params={"set_id": SET})
    runs = r.json()
    assert [run["run_id"] for run in runs] == [1, 2]


def test_list_element_errors_endpoint_run_filter(
    client: TestClient, user_id: str
) -> None:
    db = SessionLocal()
    try:
        _record(db, user_id, [_attempt(correct=False)])  # run 1
        run_service.start_new_run(SqlAlchemySetRunsRepository(db), user_id, SET)
        _record(db, user_id, [_attempt(correct=True)])  # run 2
    finally:
        db.close()

    # Default = active run only.
    r = client.get(f"/api/users/{user_id}/element-errors")
    assert [row["run_id"] for row in r.json()] == [2]
    # run_id=1 reaches the closed run.
    r = client.get(f"/api/users/{user_id}/element-errors", params={"run_id": 1})
    assert [row["run_id"] for row in r.json()] == [1]


# --- orphan cleanup ---------------------------------------------------------


def test_deleting_a_set_sweeps_all_runs(client: TestClient, user_id: str) -> None:
    db = SessionLocal()
    try:
        _record(db, user_id, [_attempt(correct=False)])  # run 1
        run_service.start_new_run(SqlAlchemySetRunsRepository(db), user_id, SET)
        _record(db, user_id, [_attempt(correct=False)])  # run 2
    finally:
        db.close()

    r = client.post(
        f"/api/users/{user_id}/learning-data/delete",
        json={"lesson_progress_ids": [], "set_ids": [SET]},
    )
    assert r.status_code == 200, r.text

    db = SessionLocal()
    try:
        sr_repo = SqlAlchemySetRunsRepository(db)
        assert sr_repo.list_for_set(user_id, SET) == []
        ee_repo = SqlAlchemyElementErrorsRepository(db)
        assert ee_service.list_for_user(ee_repo, user_id, run_id=1) == []
        assert ee_service.list_for_user(ee_repo, user_id, run_id=2) == []
    finally:
        db.close()
