"""Integration tests for the export router (Phase 16A)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models import Curriculum, LearningProject, User
from app.routers.export import router as export_router
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    return make_client(export_router)


@pytest.fixture()
def db_session():
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _seed_user_project(db) -> tuple[str, str]:
    user = User(name="Aster", language="de")
    db.add(user)
    db.flush()
    project = LearningProject(
        user_id=user.id,
        topic="Bayes",
        goal="Learn",
        timeframe="1 week",
        daily_minutes=15,
    )
    db.add(project)
    db.commit()
    return user.id, project.id


def test_get_progress_report(client, db_session):
    user_id, _ = _seed_user_project(db_session)
    response = client.get("/api/export/progress", params={"user_id": user_id})
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "progress_report"
    assert payload["user"]["id"] == user_id


def test_get_progress_report_unknown_user_404(client):
    response = client.get("/api/export/progress", params={"user_id": "missing"})
    assert response.status_code == 404


def test_get_progress_report_respects_lang(client, db_session):
    user_id, _ = _seed_user_project(db_session)
    response = client.get(
        "/api/export/progress", params={"user_id": user_id, "lang": "en"}
    )
    assert response.json()["lang"] == "en"


def test_get_session_detail_404(client):
    response = client.get("/api/export/session/missing")
    assert response.status_code == 404


def test_get_curriculum_overview(client, db_session):
    user_id, _ = _seed_user_project(db_session)
    curriculum = Curriculum(user_id=user_id, title="My Curriculum", language="de")
    db_session.add(curriculum)
    db_session.commit()
    response = client.get(f"/api/export/curriculum/{curriculum.id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "curriculum_overview"
    assert payload["curriculum"]["title"] == "My Curriculum"


def test_get_curriculum_overview_404(client):
    response = client.get("/api/export/curriculum/missing")
    assert response.status_code == 404
