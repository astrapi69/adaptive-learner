"""Sync surface audit (Phase 21E).

Pins the invariant that EVERY SQLAlchemy domain model is in the
sync surface. Without this guardrail, adding a new model is a
silent data-loss bug on the next device-switch: the user's data
on device A never travels to device B.

The audit also pins:
  - Backend ``TABLES`` and the SQLAlchemy ``Base.metadata`` agree
    on table names + count.
  - Every entry in ``TABLES`` references a real model.
  - Classifications (append-only vs mutable) are documented per
    the v1.8.0 / Phase 21 spec.

The frontend ``SYNC_TABLES`` cross-check lives in
``frontend/src/storage/sync-engine.test.ts`` (Vitest); this
file is the backend half of the same invariant.
"""

from __future__ import annotations

from app.models import Base
from app.services.sync_service import (
    ALL_SYNC_TABLES,
    APPEND_ONLY_TABLES,
    MUTABLE_TABLES,
    TABLES,
)


# Expected sync-surface classification per the Phase 21 + 22 spec.
EXPECTED_MUTABLE: frozenset[str] = frozenset(
    {
        "users",
        "user_settings",
        "learning_projects",
        "learning_profiles",
        "curriculums",
        "learning_topics",
        "lessons",
        # v1.8.0 / Phase 21B: promoted from append-only.
        "session_notes",
        # v1.9.0 / Phase 22A: taxonomy.
        "subjects",
        "tags",
        # v1.16.0 / Phase 29A: gamification XP singleton.
        "user_xp",
        # v1.16.0 / Phase 29B: badge catalog (mutable for icon /
        # i18n key edits across releases).
        "badges",
    }
)

EXPECTED_APPEND_ONLY: frozenset[str] = frozenset(
    {
        "learning_sessions",
        "session_messages",
        "session_ratings",
        "progress_commits",
        "method_switches",
        # v1.8.0 / Phase 21A: aligned with backend column names.
        "step_evaluations",
        # v1.8.0 / Phase 21D: chat-history imports.
        "imported_conversations",
        "imported_messages",
        # v1.9.0 / Phase 22A: M:N taxonomy associations.
        "project_subjects",
        "project_tags",
        # v1.16.0 / Phase 29B: earned-badge record.
        "user_badges",
    }
)


def test_every_sqlalchemy_model_table_is_in_the_sync_surface():
    """Each row of every domain model must be syncable. The
    ``Base.metadata.tables`` keys are the authoritative list of
    SQLAlchemy table names; ``TABLES`` (sync_service) is the
    authoritative list of synced tables. The difference must be
    empty in both directions."""
    declared_tables = {
        name
        for name in Base.metadata.tables.keys()
        # Alembic's own ``alembic_version`` table is bookkeeping,
        # not domain data.
        if name != "alembic_version"
    }
    sync_tables = set(ALL_SYNC_TABLES)
    missing_from_sync = declared_tables - sync_tables
    extra_in_sync = sync_tables - declared_tables
    assert not missing_from_sync, (
        f"Tables declared as SQLAlchemy models but NOT in the sync surface "
        f"(potential data-loss on device switch): {sorted(missing_from_sync)}"
    )
    assert not extra_in_sync, (
        f"Tables in the sync surface but no SQLAlchemy model: "
        f"{sorted(extra_in_sync)}"
    )


def test_sync_table_count_matches_model_count():
    """Belt-and-braces check on top of the symmetric-difference
    test above — a single-number assertion that's easier to read
    on a CI failure."""
    declared = {
        name for name in Base.metadata.tables.keys() if name != "alembic_version"
    }
    assert len(TABLES) == len(declared), (
        f"TABLES has {len(TABLES)} entries; SQLAlchemy declares "
        f"{len(declared)} tables. Likely cause: a model was added "
        f"without a corresponding TABLES entry."
    )


def test_append_only_classification_matches_spec():
    """The append-only / mutable classification is per-table
    contract — pin it so a future refactor can't silently flip
    a table's sync semantics."""
    assert APPEND_ONLY_TABLES == EXPECTED_APPEND_ONLY, (
        f"APPEND_ONLY drift: "
        f"in TABLES but not spec: {sorted(APPEND_ONLY_TABLES - EXPECTED_APPEND_ONLY)}, "
        f"in spec but not TABLES: {sorted(EXPECTED_APPEND_ONLY - APPEND_ONLY_TABLES)}"
    )
    assert MUTABLE_TABLES == EXPECTED_MUTABLE, (
        f"MUTABLE drift: "
        f"in TABLES but not spec: {sorted(MUTABLE_TABLES - EXPECTED_MUTABLE)}, "
        f"in spec but not TABLES: {sorted(EXPECTED_MUTABLE - MUTABLE_TABLES)}"
    )


def test_every_table_spec_references_a_real_sqlalchemy_model():
    """``TableSpec.model`` must point at a SQLAlchemy class. A
    typo / a copy-paste from the wrong import would surface here
    rather than at the first sync attempt."""
    declared_models = set(Base.metadata.tables.keys())
    for name, spec in TABLES.items():
        model_table = spec.model.__tablename__
        assert model_table == name, (
            f"TABLES[{name!r}].model is {spec.model.__name__} "
            f"with __tablename__={model_table!r}; expected {name!r}."
        )
        assert model_table in declared_models, (
            f"TABLES[{name!r}].model.__tablename__={model_table!r} "
            f"is not in Base.metadata.tables."
        )


def test_every_table_spec_has_a_valid_timestamp_field():
    """The sync filter compares rows by ``spec.timestamp_field``
    against the last-sync timestamp. The field MUST exist as a
    column on the model — a typo would silently return zero
    rows."""
    for name, spec in TABLES.items():
        cols = spec.model.__table__.columns.keys()
        assert spec.timestamp_field in cols, (
            f"TABLES[{name!r}].timestamp_field={spec.timestamp_field!r} "
            f"is not a column on {spec.model.__name__}. "
            f"Available columns: {sorted(cols)}"
        )


def test_every_table_spec_has_columns_that_exist_on_the_model():
    """Each ``columns`` tuple is what the sync wire shape ships.
    A column name that doesn't exist on the model would crash
    when ``serialize_row`` tries to read it; pin that
    statically here."""
    for name, spec in TABLES.items():
        actual = set(spec.model.__table__.columns.keys())
        declared = set(spec.columns)
        missing = declared - actual
        assert not missing, (
            f"TABLES[{name!r}].columns references {sorted(missing)} "
            f"but the model {spec.model.__name__} has columns "
            f"{sorted(actual)}."
        )
