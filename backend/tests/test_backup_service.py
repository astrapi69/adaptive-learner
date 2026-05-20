"""Tests for the backup + restore service (Phase 15A).

Covers:

- Round-trip: create_backup -> restore_backup yields the same
  row counts (plus updated_at-newer wins, plus duplicates skipped).
- API keys never reach the backup payload.
- API keys present in a restored payload are silently dropped (the
  user must re-enter them).
- Merge semantics: append-only rows skipped on conflict, mutable
  rows keep the newer side, never deletes.
- Malformed payloads raise ValidationError with a useful detail.
- Missing user raises NotFoundError.
- get_backup_stats matches the row counts the export carries.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.exceptions import NotFoundError, ValidationError
from app.models import (
    Curriculum,
    LearningProfile,
    LearningProject,
    LearningSession,
    Lesson,
    LearningTopic,
    ProgressCommit,
    SessionMessage,
    SessionRating,
    User,
    UserSettings,
)
from app.routers.backup import router as backup_router
from app.routers.users import router as users_router
from app.services.backup_service import (
    BACKUP_FORMAT,
    BACKUP_VERSION,
    EXCLUDED_USER_SETTINGS_FIELDS,
    create_backup,
    get_backup_stats,
    restore_backup,
)
from tests.router_test_client import make_client


# ---- Fixtures --------------------------------------------------------------


@pytest.fixture()
def client() -> TestClient:
    return make_client(users_router, backup_router)


@pytest.fixture()
def db_session():
    """Direct SQLAlchemy session bound to the in-memory test DB."""
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _seed_user(db) -> User:
    """Insert a user with settings + project + curriculum + session."""
    user = User(name="Aster", email=None, language="de")
    db.add(user)
    db.flush()

    settings = UserSettings(
        user_id=user.id,
        active_provider="anthropic",
        api_key_anthropic="sk-secret-anthropic",
        api_key_openai="sk-secret-openai",
        api_key_gemini=None,
    )
    db.add(settings)

    project = LearningProject(
        user_id=user.id,
        topic="Bayes",
        goal="Master it",
        timeframe="2 weeks",
        daily_minutes=30,
    )
    db.add(project)
    db.flush()

    profile = LearningProfile(
        user_id=user.id,
        project_id=project.id,
        deductive=0.5,
        inductive=0.5,
        error_based=0.0,
        dialogic=0.0,
        contextual=0.0,
        ai_adaptive=0.0,
    )
    db.add(profile)

    curriculum = Curriculum(user_id=user.id, title="Intro", language="de")
    db.add(curriculum)
    db.flush()

    topic = LearningTopic(curriculum_id=curriculum.id, title="Section 1", order_index=0)
    lesson = Lesson(curriculum_id=curriculum.id, title="Lesson 1", content="Hello", order_index=0)
    db.add_all([topic, lesson])
    db.flush()

    session = LearningSession(
        project_id=project.id,
        method="deductive",
        cycle_step=1,
        status="active",
    )
    db.add(session)
    db.flush()

    db.add(
        SessionMessage(session_id=session.id, role="user", content="Hi")
    )
    db.add(
        SessionRating(
            session_id=session.id,
            understanding=4,
            stress=2,
            method_fit=5,
        )
    )
    db.add(
        ProgressCommit(
            project_id=project.id,
            session_id=session.id,
            method="deductive",
            understanding=0.8,
            stress=0.2,
            error_rate=0.1,
            duration_minutes=25,
        )
    )

    db.commit()
    db.refresh(user)
    return user


# ---- Create-backup tests ---------------------------------------------------


def test_create_backup_returns_canonical_envelope(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)
    assert payload["format"] == BACKUP_FORMAT
    assert payload["version"] == BACKUP_VERSION
    assert payload["user_id"] == user.id
    assert payload["storage_mode"] == "api"
    assert "created_at" in payload
    assert "data" in payload
    assert "stats" in payload


def test_create_backup_includes_every_known_table(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)
    data = payload["data"]
    for table in (
        "users",
        "user_settings",
        "learning_projects",
        "learning_profiles",
        "curriculums",
        "learning_topics",
        "lessons",
        "learning_sessions",
        "session_messages",
        "session_ratings",
        "session_notes",
        "progress_commits",
        "method_switches",
        "step_evaluations",
        "imported_conversations",
        "imported_messages",
    ):
        assert table in data, f"missing table: {table}"


def test_create_backup_excludes_api_keys(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)
    settings = payload["data"]["user_settings"]
    assert len(settings) == 1
    row = settings[0]
    for field in EXCLUDED_USER_SETTINGS_FIELDS:
        assert field not in row, f"API key field leaked into backup: {field}"
    # Non-secret settings fields ARE present.
    assert row["active_provider"] == "anthropic"
    assert row["user_id"] == user.id


def test_create_backup_carries_storage_mode_hint(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id, storage_mode="dexie")
    assert payload["storage_mode"] == "dexie"


def test_create_backup_unknown_user_raises_404(db_session):
    with pytest.raises(NotFoundError):
        create_backup(db_session, "nonexistent-user-id")


def test_create_backup_filters_to_user(db_session):
    """A second user's rows must NOT appear in user A's backup."""
    user_a = _seed_user(db_session)
    user_b = User(name="Other", email=None, language="de")
    db_session.add(user_b)
    db_session.flush()
    db_session.add(
        LearningProject(
            user_id=user_b.id,
            topic="Other topic",
            goal="Other goal",
            timeframe="1 week",
            daily_minutes=10,
        )
    )
    db_session.commit()

    payload = create_backup(db_session, user_a.id)
    project_user_ids = {row["user_id"] for row in payload["data"]["learning_projects"]}
    assert project_user_ids == {user_a.id}


def test_create_backup_stats_match_row_counts(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)
    stats = payload["stats"]
    for table, rows in payload["data"].items():
        assert stats["tables"].get(table) == len(rows)
    assert stats["total_records"] == sum(len(rows) for rows in payload["data"].values())


# ---- get_backup_stats tests -----------------------------------------------


def test_get_backup_stats_matches_export(db_session):
    user = _seed_user(db_session)
    stats = get_backup_stats(db_session, user.id)
    payload = create_backup(db_session, user.id)
    assert stats["tables"] == payload["stats"]["tables"]


def test_get_backup_stats_unknown_user_raises(db_session):
    with pytest.raises(NotFoundError):
        get_backup_stats(db_session, "nonexistent")


# ---- Restore tests ---------------------------------------------------------


def test_restore_to_empty_db_recreates_all_rows(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)

    # Wipe the database. The restore must be able to repopulate from
    # the backup alone.
    for model in (
        ProgressCommit,
        SessionMessage,
        SessionRating,
        LearningSession,
        Lesson,
        LearningTopic,
        Curriculum,
        LearningProfile,
        LearningProject,
        UserSettings,
        User,
    ):
        db_session.query(model).delete()
    db_session.commit()
    assert db_session.query(User).count() == 0

    summary = restore_backup(db_session, payload)
    assert summary["user_id"] == user.id
    assert summary["inserted"] >= 11  # user + settings + project + ... at minimum
    assert db_session.query(User).filter(User.id == user.id).first() is not None
    assert db_session.query(LearningProject).count() == 1


def test_restore_skips_existing_rows_in_append_only_tables(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)
    summary = restore_backup(db_session, payload)
    # Append-only rows (messages, ratings, commits, sessions) should
    # be skipped because they already exist.
    assert summary["skipped"] >= 1
    assert summary["inserted"] == 0  # no new rows
    assert summary["updated"] == 0  # mutable rows have identical timestamps


def test_restore_uses_newer_timestamp_for_mutable_rows(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)

    # Modify the local user with a newer updated_at after backup.
    future = datetime.now(UTC) + timedelta(days=1)
    user_row = db_session.get(User, user.id)
    user_row.name = "Local-newer"
    user_row.updated_at = future
    db_session.commit()

    summary = restore_backup(db_session, payload)
    # Local is newer; backup row should be skipped, not overwrite.
    assert db_session.get(User, user.id).name == "Local-newer"
    assert summary["updated"] == 0


def test_restore_overwrites_when_backup_is_newer(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)

    # Forge a newer timestamp on the backup's user row to simulate
    # "backup is from the future".
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    for row in payload["data"]["users"]:
        if row["id"] == user.id:
            row["updated_at"] = future
            row["name"] = "From-backup"

    summary = restore_backup(db_session, payload)
    assert db_session.get(User, user.id).name == "From-backup"
    assert summary["updated"] >= 1


def test_restore_strips_api_keys_even_if_present(db_session):
    """A hand-edited backup carrying api_key_* fields must not poison
    the live UserSettings row."""
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)

    # Inject API keys into the payload as a malicious user would.
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    for row in payload["data"]["user_settings"]:
        row["api_key_anthropic"] = "sk-injected-key"
        row["api_key_openai"] = "sk-injected-key"
        row["api_key_gemini"] = "sk-injected-key"
        row["updated_at"] = future
        row["active_provider"] = "gemini"

    restore_backup(db_session, payload)
    settings = (
        db_session.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    )
    # Live keys survived; injected keys did not land.
    assert settings.api_key_anthropic == "sk-secret-anthropic"
    assert settings.api_key_openai == "sk-secret-openai"
    assert settings.api_key_gemini is None
    # Non-secret field updated as expected.
    assert settings.active_provider == "gemini"


def test_restore_rejects_unknown_format(db_session):
    with pytest.raises(ValidationError):
        restore_backup(db_session, {"format": "not-ours", "version": "1.0", "data": {}})


def test_restore_rejects_non_dict(db_session):
    with pytest.raises(ValidationError):
        restore_backup(db_session, "not a dict")


def test_restore_rejects_missing_data_segment(db_session):
    with pytest.raises(ValidationError):
        restore_backup(
            db_session, {"format": BACKUP_FORMAT, "version": BACKUP_VERSION}
        )


def test_restore_rejects_missing_user_id(db_session):
    with pytest.raises(ValidationError):
        restore_backup(
            db_session,
            {"format": BACKUP_FORMAT, "version": BACKUP_VERSION, "data": {}},
        )


def test_restore_uses_target_user_id_override(db_session):
    user = _seed_user(db_session)
    payload = create_backup(db_session, user.id)
    # Drop the user_id from the payload; supply via override.
    payload["user_id"] = None
    summary = restore_backup(db_session, payload, target_user_id=user.id)
    assert summary["user_id"] == user.id


# ---- HTTP endpoint tests ---------------------------------------------------


def _make_user_via_api(client: TestClient, name: str = "Aster") -> str:
    resp = client.post("/api/users", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_export_endpoint_returns_attachment(client: TestClient):
    user_id = _make_user_via_api(client)
    resp = client.get("/api/backup/export", params={"user_id": user_id})
    assert resp.status_code == 200, resp.text
    cd = resp.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert ".json" in cd
    body = resp.json()
    assert body["format"] == BACKUP_FORMAT
    assert body["user_id"] == user_id


def test_export_endpoint_pretty_prints_json(client: TestClient):
    """The downloaded file is meant to be human-readable; check that
    the body is multiline (indented) not minified."""
    user_id = _make_user_via_api(client)
    resp = client.get("/api/backup/export", params={"user_id": user_id})
    assert "\n" in resp.text
    assert "  " in resp.text  # at least one indented line


def test_export_endpoint_404s_unknown_user(client: TestClient):
    resp = client.get("/api/backup/export", params={"user_id": "nonexistent"})
    assert resp.status_code == 404


def test_stats_endpoint_returns_table_counts(client: TestClient):
    user_id = _make_user_via_api(client)
    resp = client.get("/api/backup/stats", params={"user_id": user_id})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert "tables" in body
    assert "total_records" in body
    assert body["tables"].get("users") == 1


def test_import_endpoint_accepts_export_roundtrip(client: TestClient):
    user_id = _make_user_via_api(client)
    export = client.get("/api/backup/export", params={"user_id": user_id})
    payload = export.json()
    resp = client.post(
        "/api/backup/import", params={"user_id": user_id}, json=payload
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["skipped"] >= 1  # the user row was idempotent


def test_import_endpoint_rejects_malformed_payload(client: TestClient):
    user_id = _make_user_via_api(client)
    resp = client.post(
        "/api/backup/import",
        params={"user_id": user_id},
        json={"format": "not-ours", "version": "1.0", "data": {}},
    )
    assert resp.status_code == 400


def test_import_endpoint_rejects_missing_data_segment(client: TestClient):
    user_id = _make_user_via_api(client)
    resp = client.post(
        "/api/backup/import",
        params={"user_id": user_id},
        json={"format": "adaptive-learner-backup", "version": "1.2.0"},
    )
    assert resp.status_code == 400
