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

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import Base
from app.exceptions import NotFoundError, ValidationError
from app.models import (
    AnkiCardSuggestion,
    ApiKeyBackup,
    Badge,
    Curriculum,
    ElementError,
    ImportedConversation,
    ImportedMessage,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    LessonProgress,
    MethodSwitch,
    ProgressCommit,
    ProjectSubject,
    ProjectTag,
    SessionMessage,
    SessionNote,
    SessionRating,
    StepEvaluation,
    StudyQuestion,
    Subject,
    Tag,
    User,
    UserBadge,
    UserMission,
    UserSettings,
    UserStreak,
    UserXP,
)
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.routers.backup import router as backup_router
from app.routers.users import router as users_router
from app.services.backup_service import (
    _RESTORE_ORDER as RESTORE_ORDER,
)
from app.services.backup_service import (
    ALL_BACKUP_TABLES,
    BACKUP_FORMAT,
    BACKUP_VERSION,
    EXCLUDED_USER_SETTINGS_FIELDS,
    create_backup,
    get_backup_stats,
    restore_backup,
)
from app.services.sync_service import TABLES as SYNC_TABLES
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

    db.add(SessionMessage(session_id=session.id, role="user", content="Hi"))
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


def _seed_all_tables(db) -> User:
    """Insert at least one row into EVERY backup table.

    The base ``_seed_user`` covers 11 tables; this fills in the
    remaining 19 (gamification, SRS, missions, taxonomy, anki,
    study-questions, lesson-progress, api-key-backup, the imports
    pair, session notes, method switches, step evaluations) so a
    full 30-table round-trip can be exercised. This is the data
    that BACKUP-API-RESTORE-01 silently dropped on restore.
    """
    user = _seed_user(db)
    project = db.query(LearningProject).filter(LearningProject.user_id == user.id).first()
    session = db.query(LearningSession).filter(LearningSession.project_id == project.id).first()

    # session_notes / method_switches / step_evaluations
    db.add(SessionNote(session_id=session.id, content="A note I took"))
    db.add(
        MethodSwitch(
            project_id=project.id,
            from_method="deductive",
            to_method="inductive",
            reason="stagnation detected",
        )
    )
    db.add(
        StepEvaluation(
            session_id=session.id,
            from_step=1,
            to_step=2,
            advance=True,
            confidence=0.9,
            applied=True,
        )
    )

    # imported_conversations / imported_messages
    conversation = ImportedConversation(
        user_id=user.id,
        project_id=project.id,
        source="chatgpt",
        title="Imported chat",
        message_count=1,
    )
    db.add(conversation)
    db.flush()
    db.add(
        ImportedMessage(
            conversation_id=conversation.id,
            role="user",
            content="What is Bayes' theorem?",
            order_index=0,
        )
    )

    # taxonomy: subjects (global) + tags (user) + the two M:N rows
    subject = Subject(name="Mathematics")
    db.add(subject)
    tag = Tag(user_id=user.id, name="exam-prep", color="#ff0000")
    db.add(tag)
    db.flush()
    db.add(ProjectSubject(project_id=project.id, subject_id=subject.id))
    db.add(ProjectTag(project_id=project.id, tag_id=tag.id))

    # gamification
    db.add(UserXP(user_id=user.id, total_xp=100, level=2))
    badge = Badge(
        key="streak_7", name_key="badges.streak_7.name", description_key="badges.streak_7.desc"
    )
    db.add(badge)
    db.flush()
    db.add(UserBadge(user_id=user.id, badge_id=badge.id, tier="silver"))
    db.add(
        UserStreak(
            user_id=user.id, current_streak_days=5, longest_streak_days=12, freezes_available=1
        )
    )

    # anki + study questions
    db.add(AnkiCardSuggestion(user_id=user.id, front="Q front", back="A back", accepted=True))
    db.add(
        StudyQuestion(
            user_id=user.id,
            project_id=project.id,
            question="Why does the prior matter?",
            expected_answer="It encodes belief before evidence.",
        )
    )

    # content-loader: lesson progress + element errors
    db.add(
        LessonProgress(
            user_id=user.id,
            source="astrapi69/adaptive-learner-content",
            set_id="fr-a1",
            lesson_filename="01-intro.json",
            status="completed",
            score_correct=8,
            score_total=10,
        )
    )
    db.add(
        ElementError(
            user_id=user.id,
            set_id="fr-a1",
            lesson_id="01-intro.json",
            exercise_id="ex-1",
            element_key="merci",
            error_count=2,
            correct_streak=1,
        )
    )

    # missions + api-key backup (Fernet ciphertext travels as-is)
    db.add(
        UserMission(user_id=user.id, template_id="daily_lessons_1", assigned_date=date(2026, 6, 2))
    )
    db.add(
        ApiKeyBackup(
            user_id=user.id,
            provider="anthropic",
            encrypted_key="gAAAAAB-ciphertext-blob",
        )
    )

    db.commit()
    db.refresh(user)
    return user


def _wipe_all_tables(db) -> None:
    """Delete every backup table in reverse restore order (children
    before parents) so FK constraints never block the wipe.

    Guarded: this helper bulk-deletes every table, so it must never run
    against a production-marked data dir. ``assert_safe_for_destructive_use``
    raises there (BACKUP-API-RESTORE-01 — a copied-out wipe helper hit
    the real DB)."""
    from app.db_guard import assert_safe_for_destructive_use

    assert_safe_for_destructive_use("backup-test full-table wipe")
    for table in reversed(RESTORE_ORDER):
        db.query(SYNC_TABLES[table].model).delete()
    db.commit()


# ---- Create-backup tests ---------------------------------------------------


def test_create_backup_returns_canonical_envelope(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    assert payload["format"] == BACKUP_FORMAT
    assert payload["version"] == BACKUP_VERSION
    assert payload["user_id"] == user.id
    assert payload["storage_mode"] == "api"
    assert "created_at" in payload
    assert "data" in payload
    assert "stats" in payload


def test_create_backup_includes_every_known_table(db_session):
    """Export carries ALL known tables and nothing outside the surface;
    every table is present even when empty (#126, reverting #117). A
    complete snapshot makes an absent table impossible to confuse with
    an empty one."""
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    data = payload["data"]
    # Exactly the known surface — no more, no less.
    assert set(data.keys()) == set(ALL_BACKUP_TABLES)
    # No unknown tables leak in (every key is a known table).
    for table in data:
        assert table in ALL_BACKUP_TABLES, f"unknown table: {table}"
    # The seeded core tables carry rows.
    for table in (
        "users",
        "user_settings",
        "learning_projects",
        "learning_profiles",
        "curriculums",
        "lessons",
        "learning_sessions",
        "session_messages",
    ):
        assert table in data, f"seeded table missing: {table}"


def test_create_backup_excludes_api_keys(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
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
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id, storage_mode="dexie")
    assert payload["storage_mode"] == "dexie"


def test_create_backup_unknown_user_raises_404(db_session):
    with pytest.raises(NotFoundError):
        create_backup(SqlAlchemyBackupRepository(db_session), "nonexistent-user-id")


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

    payload = create_backup(SqlAlchemyBackupRepository(db_session), user_a.id)
    project_user_ids = {row["user_id"] for row in payload["data"]["learning_projects"]}
    assert project_user_ids == {user_a.id}


def test_create_backup_stats_match_row_counts(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    stats = payload["stats"]
    for table, rows in payload["data"].items():
        assert stats["tables"].get(table) == len(rows)
    assert stats["total_records"] == sum(len(rows) for rows in payload["data"].values())


# ---- get_backup_stats tests -----------------------------------------------


def test_get_backup_stats_matches_export(db_session):
    user = _seed_user(db_session)
    stats = get_backup_stats(SqlAlchemyBackupRepository(db_session), user.id)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    assert stats["tables"] == payload["stats"]["tables"]


def test_get_backup_stats_unknown_user_raises(db_session):
    with pytest.raises(NotFoundError):
        get_backup_stats(SqlAlchemyBackupRepository(db_session), "nonexistent")


# ---- Restore tests ---------------------------------------------------------


def test_restore_to_empty_db_recreates_all_rows(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)

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

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["user_id"] == user.id
    assert summary["inserted"] >= 11  # user + settings + project + ... at minimum
    assert db_session.query(User).filter(User.id == user.id).first() is not None
    assert db_session.query(LearningProject).count() == 1


def test_restore_skips_existing_rows_in_append_only_tables(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    # Append-only rows (messages, ratings, commits, sessions) should
    # be skipped because they already exist.
    assert summary["skipped"] >= 1
    assert summary["inserted"] == 0  # no new rows
    assert summary["updated"] == 0  # mutable rows have identical timestamps


def test_restore_uses_newer_timestamp_for_mutable_rows(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)

    # Modify the local user with a newer updated_at after backup.
    future = datetime.now(UTC) + timedelta(days=1)
    user_row = db_session.get(User, user.id)
    user_row.name = "Local-newer"
    user_row.updated_at = future
    db_session.commit()

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    # Local is newer; backup row should be skipped, not overwrite.
    assert db_session.get(User, user.id).name == "Local-newer"
    assert summary["updated"] == 0


def test_restore_overwrites_when_backup_is_newer(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)

    # Forge a newer timestamp on the backup's user row to simulate
    # "backup is from the future".
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    for row in payload["data"]["users"]:
        if row["id"] == user.id:
            row["updated_at"] = future
            row["name"] = "From-backup"

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert db_session.get(User, user.id).name == "From-backup"
    assert summary["updated"] >= 1


def test_restore_strips_api_keys_even_if_present(db_session):
    """A hand-edited backup carrying api_key_* fields must not poison
    the live UserSettings row."""
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)

    # Inject API keys into the payload as a malicious user would.
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    for row in payload["data"]["user_settings"]:
        row["api_key_anthropic"] = "sk-injected-key"
        row["api_key_openai"] = "sk-injected-key"
        row["api_key_gemini"] = "sk-injected-key"
        row["updated_at"] = future
        row["active_provider"] = "gemini"

    restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    settings = db_session.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    # Live keys survived; injected keys did not land.
    assert settings.api_key_anthropic == "sk-secret-anthropic"
    assert settings.api_key_openai == "sk-secret-openai"
    assert settings.api_key_gemini is None
    # Non-secret field updated as expected.
    assert settings.active_provider == "gemini"


def test_restore_rejects_unknown_format(db_session):
    with pytest.raises(ValidationError):
        restore_backup(
            SqlAlchemyBackupRepository(db_session),
            {"format": "not-ours", "version": "1.0", "data": {}},
        )


def test_restore_rejects_non_dict(db_session):
    with pytest.raises(ValidationError):
        restore_backup(SqlAlchemyBackupRepository(db_session), "not a dict")


def test_restore_rejects_missing_data_segment(db_session):
    with pytest.raises(ValidationError):
        restore_backup(
            SqlAlchemyBackupRepository(db_session),
            {"format": BACKUP_FORMAT, "version": BACKUP_VERSION},
        )


def test_restore_rejects_missing_user_id(db_session):
    with pytest.raises(ValidationError):
        restore_backup(
            SqlAlchemyBackupRepository(db_session),
            {"format": BACKUP_FORMAT, "version": BACKUP_VERSION, "data": {}},
        )


def test_restore_uses_target_user_id_override(db_session):
    user = _seed_user(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    # Drop the user_id from the payload; supply via override.
    payload["user_id"] = None
    summary = restore_backup(
        SqlAlchemyBackupRepository(db_session), payload, target_user_id=user.id
    )
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
    resp = client.post("/api/backup/import", params={"user_id": user_id}, json=payload)
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


# ---- Full-surface parity + round-trip (BACKUP-API-RESTORE-01) ---------------


def test_export_and_restore_cover_the_same_tables():
    """Structural pin: the export surface and the restore surface MUST
    be identical. This is the test that would have caught
    BACKUP-API-RESTORE-01 — the export listed 30 tables while the
    restore order silently covered only 16, dropping 14 on restore.
    """
    assert set(ALL_BACKUP_TABLES) == set(RESTORE_ORDER)
    # No table is listed twice in the restore order.
    assert len(RESTORE_ORDER) == len(set(RESTORE_ORDER))
    # Both sides match the sync surface (the single source of truth).
    assert set(ALL_BACKUP_TABLES) == set(SYNC_TABLES.keys())


def test_restore_order_respects_fk_dependencies():
    """COMPREHENSIVE FK-order pin: for EVERY cross-table foreign key in
    the model metadata, the referenced table must come strictly before
    the referencing table in the restore order.

    This enumerates the FK graph from SQLAlchemy metadata rather than a
    hand-maintained list of pairs — the previous version checked only a
    handful of known pairs and so MISSED
    ``curriculums``/``learning_sessions`` -> ``imported_conversations``
    (both carry an ``imported_conversation_id`` FK), which produced a
    real FK-violation data-loss bug on restore. A new FK can no longer
    silently create a gap; this test fails the moment one does.

    Self-referential FKs (``learning_topics.parent_id``,
    ``subjects.parent_id``) are intentionally NOT checked here — table
    ordering cannot satisfy them (a child row may precede its parent in
    the same table's list); they are handled by
    ``PRAGMA defer_foreign_keys=ON`` in ``restore_backup`` and covered by
    the round-trip regression test below.
    """
    position = {table: i for i, table in enumerate(RESTORE_ORDER)}
    sync = set(SYNC_TABLES)

    checked = 0
    violations: list[str] = []
    for table in Base.metadata.sorted_tables:
        if table.name not in sync:
            continue
        for fk in table.foreign_keys:
            ref = fk.column.table.name
            src = table.name
            if ref == src:
                continue  # self-referential — see PRAGMA defer_foreign_keys
            assert ref in position, (
                f"{src}.{fk.parent.name} references {ref}, which is not in the restore order"
            )
            checked += 1
            if position[ref] >= position[src]:
                violations.append(
                    f"{ref} (pos {position[ref]}) must come BEFORE {src} "
                    f"(pos {position[src]}) — FK {src}.{fk.parent.name}"
                )
    assert not violations, "Restore-order FK violations:\n" + "\n".join(violations)
    # Guard against the enumeration silently checking nothing.
    assert checked >= 15, f"expected many cross-table FKs, only saw {checked}"

    # Explicit regression markers for the exact bug that motivated this:
    assert position["imported_conversations"] < position["curriculums"]
    assert position["imported_conversations"] < position["learning_sessions"]


def test_restore_curriculum_from_import_and_nested_topics(db_session):
    """Regression for the restore FK-violation data-loss bug
    (BACKUP-RESTORE-FK-ORDER). The user-reported failure was
    ``INSERT INTO learning_topics ... FOREIGN KEY constraint failed`` on
    a topic TREE: ``learning_topics.parent_id`` is a self-FK, so a child
    row can be inserted before its parent within the same table — table
    ordering cannot fix that, only deferring FK checks to commit can.

    This seeds a parent/child topic tree (+ a curriculum + an imported
    conversation so the surrounding tables are populated) and asserts the
    export -> wipe -> restore round-trip succeeds with ZERO FK errors and
    preserves both the parent/child topic link AND the curriculum's
    ``imported_conversation_id`` (now part of the curriculums sync columns).
    """
    user = User(name="Tester", email=None, language="de")
    db_session.add(user)
    db_session.flush()

    conversation = ImportedConversation(user_id=user.id, title="Bayes chat")
    db_session.add(conversation)
    db_session.flush()

    curriculum = Curriculum(
        user_id=user.id,
        title="Intro",
        language="de",
        imported_conversation_id=conversation.id,
    )
    db_session.add(curriculum)
    db_session.flush()

    parent = LearningTopic(curriculum_id=curriculum.id, title="Parent", order_index=0)
    db_session.add(parent)
    db_session.flush()
    child = LearningTopic(
        curriculum_id=curriculum.id,
        parent_id=parent.id,
        title="Child",
        order_index=1,
    )
    db_session.add(child)
    db_session.flush()

    # A session that also came from the same chat import — its
    # imported_conversation_id must round-trip too.
    project = LearningProject(
        user_id=user.id,
        topic="Bayes",
        goal="Master it",
        timeframe="1 week",
        daily_minutes=20,
    )
    db_session.add(project)
    db_session.flush()
    session = LearningSession(
        project_id=project.id,
        method="deductive",
        cycle_step=1,
        status="active",
        imported_conversation_id=conversation.id,
    )
    db_session.add(session)
    db_session.flush()

    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    _wipe_all_tables(db_session)
    assert db_session.query(Curriculum).count() == 0

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["errors"] == [], summary["errors"]

    assert db_session.query(ImportedConversation).count() == 1
    restored_curriculum = db_session.query(Curriculum).one()
    # The chat-import link survives now that imported_conversation_id is a
    # curriculums sync column (was silently dropped before).
    assert restored_curriculum.imported_conversation_id == conversation.id
    topics = {t.title: t for t in db_session.query(LearningTopic).all()}
    assert set(topics) == {"Parent", "Child"}
    # The self-referential link survives the round-trip — the crux of the
    # FK bug (would 500 on restore before PRAGMA defer_foreign_keys).
    assert topics["Child"].parent_id == topics["Parent"].id
    restored_session = db_session.query(LearningSession).one()
    assert restored_session.imported_conversation_id == conversation.id


def test_export_and_restore_all_thirty_tables(db_session):
    """Round-trip the full 30-table surface: seed every table, export,
    wipe, restore, and assert every table's row count is preserved.
    """
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)

    # Every backup table carries at least one seeded row.
    before_counts = {table: len(rows) for table, rows in payload["data"].items()}
    for table in ALL_BACKUP_TABLES:
        assert before_counts.get(table, 0) >= 1, f"no rows exported for {table}"

    _wipe_all_tables(db_session)
    assert db_session.query(User).count() == 0

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["errors"] == []

    # Re-export from the restored DB and compare the per-table counts.
    after_counts = {
        table: len(rows)
        for table, rows in create_backup(SqlAlchemyBackupRepository(db_session), user.id)[
            "data"
        ].items()
    }
    assert after_counts == before_counts


def test_round_trip_preserves_table_data_that_was_being_dropped(db_session):
    """Spot-check the concrete tables BACKUP-API-RESTORE-01 dropped:
    gamification, SRS, lesson-progress, and the (encrypted) api-key
    backup all come back byte-for-byte after a wipe + restore.
    """
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    _wipe_all_tables(db_session)
    restore_backup(SqlAlchemyBackupRepository(db_session), payload)

    xp = db_session.query(UserXP).filter(UserXP.user_id == user.id).one()
    assert xp.total_xp == 100
    assert xp.level == 2

    streak = db_session.query(UserStreak).filter(UserStreak.user_id == user.id).one()
    assert streak.current_streak_days == 5
    assert streak.longest_streak_days == 12

    badge_row = db_session.query(UserBadge).filter(UserBadge.user_id == user.id).one()
    assert badge_row.tier == "silver"

    error = db_session.query(ElementError).filter(ElementError.user_id == user.id).one()
    assert error.element_key == "merci"
    assert error.error_count == 2

    progress = db_session.query(LessonProgress).filter(LessonProgress.user_id == user.id).one()
    assert progress.status == "completed"
    assert progress.score_correct == 8
    assert progress.score_total == 10

    mission = db_session.query(UserMission).filter(UserMission.user_id == user.id).one()
    assert mission.template_id == "daily_lessons_1"

    # Fernet ciphertext is opaque and useless without the install
    # secret, so it round-trips verbatim (not stripped like the
    # plaintext UserSettings.api_key_* fields).
    backup_row = db_session.query(ApiKeyBackup).filter(ApiKeyBackup.user_id == user.id).one()
    assert backup_row.encrypted_key == "gAAAAAB-ciphertext-blob"
    assert backup_row.provider == "anthropic"


def test_restore_skips_table_missing_from_backup(db_session):
    """A backup JSON missing a table segment must restore the rest
    without crashing (forward/backward-compat across app versions)."""
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    del payload["data"]["user_missions"]

    _wipe_all_tables(db_session)
    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)

    assert summary["errors"] == []
    # The dropped table simply restores nothing; everything else is back.
    assert db_session.query(UserMission).count() == 0
    assert db_session.query(UserXP).filter(UserXP.user_id == user.id).count() == 1


def test_restore_ignores_unknown_table_in_backup(db_session):
    """An unknown table segment (e.g. from a newer app version) is
    ignored rather than crashing the restore."""
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    payload["data"]["totally_made_up_table"] = [{"id": "x1", "foo": "bar"}]

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)

    assert summary["errors"] == []
    assert "totally_made_up_table" not in summary["tables"]


def test_get_backup_stats_covers_all_tables(db_session):
    """The pre-restore stats surface must report every backup table."""
    user = _seed_all_tables(db_session)
    stats = get_backup_stats(SqlAlchemyBackupRepository(db_session), user.id)
    assert set(stats["tables"].keys()) == set(ALL_BACKUP_TABLES)


# --- BACKUP-RESTORE-DATETIME-01: type-driven datetime coercion ---------


def test_datetime_fields_cover_non_at_datetime_columns():
    """Regression: restore coercion must key off the column TYPE, not a
    name heuristic. DateTime/Date columns whose name does not end in
    ``_at`` were silently passed to the INSERT as ISO strings.
    """
    from app.services import backup_service as bs

    assert "timestamp" in bs._datetime_fields("imported_messages")
    assert "created_at" in bs._datetime_fields("imported_messages")
    assert bs._datetime_fields("user_streaks") >= {
        "last_freeze_earned_on",
        "last_freeze_used_on",
    }
    assert "assigned_date" in bs._datetime_fields("user_missions")


def test_coerce_record_converts_string_timestamp_to_datetime():
    from app.services import backup_service as bs

    coerced = bs._coerce_record(
        "imported_messages",
        {
            "id": "m1",
            "timestamp": "2026-04-05T08:39:38",
            "created_at": "2026-04-05T08:39:38",
        },
    )
    assert isinstance(coerced["timestamp"], datetime)
    assert isinstance(coerced["created_at"], datetime)
    # A null datetime stays null.
    assert bs._coerce_record("imported_messages", {"timestamp": None})["timestamp"] is None


def test_restore_accepts_string_timestamp_on_imported_messages(db_session):
    """Regression: BACKUP-RESTORE-DATETIME-01 (#57). The
    ``imported_messages.timestamp`` DateTime column (name does not end in
    ``_at``) arrives as an ISO string from a JSON backup. Restore must
    coerce it instead of handing SQLite a raw str (HTTP 500 TypeError).
    """
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    msgs = payload["data"]["imported_messages"]
    assert msgs, "seed should include at least one imported message"
    # The seeded message carries timestamp=None; set a string form (as a
    # real exported backup does for messages that had a source timestamp).
    msgs[0]["timestamp"] = "2026-04-05T08:39:38"

    _wipe_all_tables(db_session)

    # Must not raise "SQLite DateTime type only accepts ... datetime".
    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["user_id"] == user.id

    restored = db_session.query(ImportedMessage).filter(ImportedMessage.id == msgs[0]["id"]).first()
    assert restored is not None
    assert isinstance(restored.timestamp, datetime)
    assert restored.timestamp.year == 2026
    assert restored.timestamp.month == 4


# --- BACKUP-RESTORE-FK-ORDER-01 (#64): imported_messages FK -----------


def test_restore_all_tables_to_empty_db_preserves_fk_chain(db_session):
    """Regression #64: restoring a full backup (incl. imported
    conversations + their messages) onto a wiped DB must not raise a
    FOREIGN KEY failure on imported_messages.conversation_id.
    """
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    assert payload["data"].get("imported_conversations")
    assert payload["data"].get("imported_messages")

    _wipe_all_tables(db_session)

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["user_id"] == user.id
    assert db_session.query(ImportedConversation).count() >= 1
    assert db_session.query(ImportedMessage).count() >= 1


def test_restore_all_tables_to_nonempty_db_preserves_fk_chain(db_session):
    """Regression #64: restore onto a DB that already holds the rows
    (idempotent re-restore) must also keep the conversation->message FK
    chain intact.
    """
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["user_id"] == user.id
    assert db_session.query(ImportedMessage).count() >= 1


def test_restore_skips_orphan_imported_message_instead_of_aborting(db_session):
    """Regression #64: a single imported_messages row whose
    imported_conversations parent is absent must be skipped (recorded in
    errors), NOT abort the entire restore with a deferred FOREIGN KEY
    failure at commit. Every valid row still lands.
    """
    user = _seed_all_tables(db_session)
    payload = create_backup(SqlAlchemyBackupRepository(db_session), user.id)
    valid_message_count = len(payload["data"]["imported_messages"])
    payload["data"]["imported_messages"].append(
        {
            "id": "orphan-msg-1",
            "conversation_id": "conversation-that-does-not-exist",
            "role": "user",
            "content": "orphaned message",
            "order_index": 99,
            "timestamp": "2026-04-05T08:39:38",
            "created_at": "2026-04-05T08:39:38",
        }
    )

    _wipe_all_tables(db_session)

    summary = restore_backup(SqlAlchemyBackupRepository(db_session), payload)
    assert summary["user_id"] == user.id
    assert db_session.query(ImportedMessage).count() == valid_message_count
    assert (
        db_session.query(ImportedMessage).filter(ImportedMessage.id == "orphan-msg-1").first()
        is None
    )
    assert any("missing" in err for err in summary["errors"])


def test_missing_fk_parent_detects_orphan_and_passes_valid(db_session):
    from app.services import backup_service as bs

    _seed_all_tables(db_session)
    conversation = db_session.query(ImportedConversation).first()
    assert conversation is not None

    assert (
        bs._missing_fk_parent(
            SqlAlchemyBackupRepository(db_session),
            "imported_messages",
            {"id": "m1", "conversation_id": conversation.id},
        )
        is None
    )
    assert (
        bs._missing_fk_parent(
            SqlAlchemyBackupRepository(db_session),
            "imported_messages",
            {"id": "m2", "conversation_id": "nope"},
        )
        == "imported_conversations"
    )
