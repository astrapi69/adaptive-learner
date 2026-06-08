"""BACKUP-AKZEPTANZTEST — real end-to-end export -> import round-trip.

Per the quality-checks.md gate: a backup-touching change is not done until a
REAL round-trip runs to completion against REAL data through the actual API.
This test drives the live HTTP path (router -> backup_service ->
BackupRepository -> DB) — NOT the service in isolation — and covers the three
scenarios the gate names:

  1. Export -> import onto a FRESH identity (cross-identity re-home, #129).
  2. Multiple non-empty tables (projects + lesson progress + the unification's
     learning_session + gamification XP/badges).
  3. Downloaded CONTENT sets (#130): a cached set is wiped before import and
     must be materialised back.

Run with ``-s --log-cli-level=INFO`` to surface the backup_service per-table
INFO log as the console proof the gate requires.
"""

from __future__ import annotations

import shutil
from collections.abc import Iterator

import pytest
from adaptive_learner_content_loader.cache import is_set_cached, store_set
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import User
from app.paths import get_cache_dir
from app.services.content_backup import CONTENT_LOADER_DIR

_MANIFEST = "schema_version: '1.0'\ntitle: Acceptance Set\nlessons:\n  - 01.json\n"
_LESSON = '{"id": "01", "title": "Lesson One"}'
_ASSET = b"\x89PNG\r\n\x1a\n acceptance-bytes"


def _cache_root():
    return get_cache_dir() / CONTENT_LOADER_DIR


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient, name: str) -> str:
    resp = client.post("/api/users", json={"name": name, "language": "de"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def test_real_backup_roundtrip_cross_identity_with_content(client: TestClient) -> None:
    # --- Seed user A across several tables -------------------------------
    user_a = _make_user(client, "Acceptance-A")

    resp = client.post(
        f"/api/users/{user_a}/projects",
        json={"topic": "Spanisch", "goal": "A2 in 3 Monaten", "timeframe": "3m", "daily_minutes": 20},
    )
    assert resp.status_code in (200, 201), resp.text

    # A completed lesson drives lesson_progress + the unification's
    # learning_session + the gamification XP/badge award.
    resp = client.post(
        f"/api/users/{user_a}/lesson-progress",
        json={
            "source": "bundled:adaptive-learner-content",
            "set_id": "es-a1",
            "lesson_filename": "01-greetings.json",
            "step_result": {"step_id": "s1", "correct": 3, "total": 3},
            "mark_completed": True,
        },
    )
    assert resp.status_code == 200, resp.text

    # --- Seed a downloaded CONTENT set into the cache (#130) -------------
    store_set(
        _cache_root(),
        "user-generated",
        "acceptance-set",
        "1.0.0",
        manifest_yaml=_MANIFEST,
        lessons={"01.json": _LESSON},
        assets={"img/pic.png": _ASSET},
    )
    assert is_set_cached(_cache_root(), "user-generated", "acceptance-set", "1.0.0")

    # --- Stats before export (the pre-restore "current" panel) ----------
    stats = client.get("/api/backup/stats", params={"user_id": user_a}).json()
    assert stats["total_records"] > 0

    # --- EXPORT (real HTTP) ---------------------------------------------
    resp = client.get("/api/backup/export", params={"user_id": user_a})
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["format"] == "adaptive-learner-backup"
    assert payload["stats"]["total_records"] > 0
    assert payload["stats"]["content_sets"] == 1
    a_total = payload["stats"]["total_records"]

    # --- Fresh identity B + wiped content cache (disaster recovery) -----
    # The new install holds a fresh identity B and only the seeded global
    # catalog. Mimic that: create B, then delete A (FK CASCADE removes A's
    # user-scoped rows) so the re-homed backup inserts rather than collides
    # with A's still-present rows.
    user_b = _make_user(client, "Acceptance-B")
    db = SessionLocal()
    try:
        db.delete(db.get(User, user_a))
        db.commit()
        assert db.get(User, user_a) is None
    finally:
        db.close()
    shutil.rmtree(_cache_root(), ignore_errors=True)
    assert not is_set_cached(_cache_root(), "user-generated", "acceptance-set", "1.0.0")

    # --- IMPORT onto B (cross-identity re-home, real HTTP) --------------
    resp = client.post("/api/backup/import", params={"user_id": user_b}, json=payload)
    assert resp.status_code == 200, resp.text
    result = resp.json()

    # The round-trip completed cleanly: rows landed, no errors, content back.
    assert result["errors"] == [], result["errors"]
    assert result["inserted"] > 0
    assert result["content_sets"]["restored"] == 1
    assert is_set_cached(_cache_root(), "user-generated", "acceptance-set", "1.0.0")

    # B now owns the re-homed data: its project is restored.
    b_projects = client.get(f"/api/users/{user_b}/projects").json()
    assert any(p["topic"] == "Spanisch" for p in b_projects)

    # B's post-restore stats match what A exported (full snapshot re-homed).
    b_stats = client.get("/api/backup/stats", params={"user_id": user_b}).json()
    assert b_stats["total_records"] == a_total
