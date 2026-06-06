"""Comprehensive backup-restore audit + regression (#115).

The prior point-fixes (#49 badges UNIQUE, #57 datetime, #64 FK-order +
orphan-skip) each addressed one symptom. The structural problem they
missed: restore matches existing rows by PRIMARY KEY only, but 13 of the
30 backup tables carry a UNIQUE constraint OTHER than the id (the
user-singleton tables ``user_settings`` / ``user_streaks`` / ``user_xp``
on ``user_id``; the composite keys on ``tags`` / ``lesson_progress`` /
``element_errors`` / ``user_badges`` / ``user_missions`` /
``project_subjects`` / ``project_tags`` / ``api_key_backups``; and
``users.email``).

When a backup is restored onto a database that already holds a row with
the same unique key under a DIFFERENT id — the normal case for an
*older* backup, or a *clean install* where the app auto-seeds a
``user_settings`` row via ``get_or_create_settings`` — the id lookup
misses, restore tries to INSERT, and the UNIQUE constraint blows up.

These tests reproduce that across the three real-world scenarios
(clean-install import, re-import onto a non-empty DB, and an
older-backup id mismatch) and assert per-table integrity afterwards.
"""

from __future__ import annotations

import json

from app.database import SessionLocal
from app.models import (
    Badge,
    LearningProject,
    User,
    UserBadge,
    UserSettings,
    UserStreak,
    UserXP,
)
from app.services.backup_service import (
    _RESTORE_ORDER,
    create_backup,
    get_backup_stats,
    restore_backup,
)


def _session():
    return SessionLocal()


def _seed(db) -> User:
    user = User(name="Aster", email="aster@example.com", language="de")
    db.add(user)
    db.flush()
    db.add(UserSettings(user_id=user.id, active_provider="anthropic"))
    db.add(UserXP(user_id=user.id, total_xp=120, level=3))
    db.add(UserStreak(user_id=user.id, current_streak_days=4, longest_streak_days=9))
    db.add(
        LearningProject(
            user_id=user.id,
            topic="Bayes",
            goal="Master it",
            timeframe="2 weeks",
            daily_minutes=30,
        )
    )
    db.commit()
    return user


def test_reimport_with_reseeded_singletons_does_not_violate_unique():
    """The headline failure: an older backup / clean install whose
    ``user_settings`` etc. carry a different id than the local rows.

    Restoring must MATCH the existing singleton by its unique key and
    update it in place, not INSERT a duplicate (UNIQUE(user_id)).
    """
    db = _session()
    try:
        user = _seed(db)
        backup = create_backup(db, user.id)

        # Simulate the real trigger: the local singleton rows now carry
        # DIFFERENT ids than the backup (older backup, or a clean
        # install that auto-seeded them via get_or_create_settings).
        for model in (UserSettings, UserXP, UserStreak):
            row = db.query(model).filter(model.user_id == user.id).one()
            db.delete(row)
        db.flush()
        db.add(UserSettings(user_id=user.id, active_provider="openai"))
        db.add(UserXP(user_id=user.id, total_xp=0, level=1))
        db.add(UserStreak(user_id=user.id, current_streak_days=0, longest_streak_days=0))
        db.commit()

        # Must not raise IntegrityError; must reconcile by unique key.
        result = restore_backup(db, backup)
        assert result["errors"] == []

        # The backup's values won (newer timestamp), matched in place —
        # exactly one row per user, carrying the restored data.
        settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).all()
        assert len(settings) == 1
        assert settings[0].active_provider == "anthropic"
        xp = db.query(UserXP).filter(UserXP.user_id == user.id).all()
        assert len(xp) == 1
        assert xp[0].total_xp == 120
    finally:
        db.close()


def _counts(db, user_id) -> dict[str, int]:
    """Per-table row counts the export sees for this user."""
    return get_backup_stats(db, user_id)["tables"]


def test_clean_install_restores_every_table():
    """Import onto an empty DB (new device): every row comes back."""
    db = _session()
    try:
        user = _seed(db)
        backup = create_backup(db, user.id)
        before = _counts(db, user.id)

        # Wipe the user (FK CASCADE removes the user-scoped rows) to
        # mimic a fresh install holding only the seeded global catalog.
        db.delete(db.get(User, user.id))
        db.commit()
        assert db.get(User, user.id) is None

        result = restore_backup(db, backup)
        assert result["errors"] == []

        after = _counts(db, user.id)
        assert after == before, f"clean-install drift: {before} -> {after}"
    finally:
        db.close()


def test_reimport_is_idempotent_no_duplicates():
    """Restoring the same backup twice onto a populated DB never
    duplicates a row or errors (re-import — the main failure case)."""
    db = _session()
    try:
        user = _seed(db)
        backup = create_backup(db, user.id)
        before = _counts(db, user.id)

        first = restore_backup(db, backup)
        assert first["errors"] == []
        second = restore_backup(db, backup)
        assert second["errors"] == []

        after = _counts(db, user.id)
        assert after == before, f"re-import duplicated rows: {before} -> {after}"
    finally:
        db.close()


def test_user_badge_fk_remaps_to_reseeded_badge():
    """A child (user_badges) whose parent badge was re-seeded under a
    different id must have its FK redirected to the local badge (the #49
    case, now handled by the general unique-key remap)."""
    db = _session()
    try:
        user = _seed(db)
        badge = Badge(key="streak_7", name_key="badge.streak_7.name", description_key="badge.streak_7.desc")
        db.add(badge)
        db.flush()
        db.add(UserBadge(user_id=user.id, badge_id=badge.id))
        db.commit()
        backup = create_backup(db, user.id)

        # Re-seed the badge under a NEW id (a fresh install's catalog).
        # Deleting the badge CASCADE-removes the local user_badge, so the
        # restore re-inserts it with the FK redirected to the new badge.
        db.delete(db.get(Badge, badge.id))
        db.flush()
        local_badge = Badge(
            key="streak_7",
            name_key="badge.streak_7.name",
            description_key="badge.streak_7.desc",
        )
        db.add(local_badge)
        db.commit()
        assert local_badge.id != badge.id

        result = restore_backup(db, backup)
        assert result["errors"] == []

        rows = db.query(UserBadge).filter(UserBadge.user_id == user.id).all()
        assert len(rows) == 1
        # FK redirected to the LOCAL badge id, not the backup's.
        assert rows[0].badge_id == local_badge.id
    finally:
        db.close()


def test_restore_order_is_fk_topological():
    """Every table appears after the tables it references (a referenced
    parent precedes its children), so per-table flush can't violate FKs."""
    position = {name: i for i, name in enumerate(_RESTORE_ORDER)}
    # A representative set of child -> parent pairs from the FK graph.
    for child, parent in [
        ("user_badges", "badges"),
        ("user_badges", "users"),
        ("learning_profiles", "learning_projects"),
        ("curriculums", "imported_conversations"),
        ("learning_sessions", "imported_conversations"),
        ("imported_messages", "imported_conversations"),
        ("lessons", "curriculums"),
        ("project_subjects", "subjects"),
    ]:
        assert position[parent] < position[child], f"{parent} must precede {child}"


def test_restore_coerces_json_text_column_from_object():
    """A backup whose JSON-in-text column (badges.tier_thresholds) is a
    parsed OBJECT — an older / Dexie-origin export — must be serialized
    on restore, not bound as a dict ("type 'dict' is not supported")."""
    db = _session()
    try:
        user = _seed(db)
        db.add(
            Badge(
                key="lessons_10",
                name_key="badge.lessons_10.name",
                description_key="badge.lessons_10.desc",
                tier_thresholds=json.dumps({"bronze": {"threshold": 10}}),
            )
        )
        db.commit()
        backup = create_backup(db, user.id)

        # Simulate the older/Dexie backup shape: an object, not a string.
        # Bump the timestamp so the merge actually applies the update
        # (and thus exercises the coercion on the way to the DB).
        for record in backup["data"]["badges"]:
            if record["key"] == "lessons_10":
                record["tier_thresholds"] = {
                    "bronze": {"threshold": 10, "xp_bonus": 50},
                    "silver": {"threshold": 50, "xp_bonus": 150},
                }
                record["updated_at"] = "2099-01-01T00:00:00+00:00"

        result = restore_backup(db, backup)
        assert result["errors"] == []

        stored = db.query(Badge).filter(Badge.key == "lessons_10").one()
        assert isinstance(stored.tier_thresholds, str)
        assert json.loads(stored.tier_thresholds)["silver"]["xp_bonus"] == 150
    finally:
        db.close()


def test_empty_tables_are_not_in_payload():
    """Tables with no rows for the user are omitted from the export
    (#117): smaller payload, smaller error surface. Restore still works
    because absent tables are tolerated."""
    db = _session()
    try:
        user = _seed(db)
        backup = create_backup(db, user.id)

        present = set(backup["data"].keys())
        # The seed touches these; they must be present.
        assert {"users", "user_settings", "user_xp", "learning_projects"} <= present
        # The user has no sessions / messages / curriculums — omitted.
        for empty in ("session_messages", "learning_sessions", "curriculums"):
            assert empty not in present, f"{empty} should be omitted when empty"

        # And a restore of the trimmed payload still succeeds.
        assert restore_backup(db, backup)["errors"] == []
    finally:
        db.close()
