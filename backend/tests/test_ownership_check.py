"""Canonical per-user ownership check (issue #329).

``row_belongs_to_user`` (ORM rows) and ``record_belongs_to_user`` (raw
record dicts) are the single source of truth for "does this row belong to
this user", shared by sync push-acceptance and backup restore. They had
drifted as two copies; a drift can leak a row across users (wrong ``True``)
or drop a legitimately-owned row (wrong ``False``).

These tests pin the resolution for every ``TableSpec.scope`` and, crucially,
the NULL-``user_id`` case that was the one real divergence between the old
copies (sync rejected it, backup trusted the parent FK). The canonical
behaviour trusts the parent FK (``None -> True``), and the two functions
MUST agree on the same logical row.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.sync_service import (
    TABLES,
    record_belongs_to_user,
    row_belongs_to_user,
)

USER = "user-1"
OTHER = "user-2"

# Representative real table per scope (asserted below so a future scope
# rename can't silently make these tests pass vacuously).
SELF_TABLE = "users"
GLOBAL_TABLE = "subjects"
DIRECT_TABLE = "tags"
VIA_TABLE = "project_subjects"  # via_project: no direct user_id column


def test_representative_tables_have_the_expected_scopes():
    """Guard: the fixtures below target the scope they claim to."""
    assert TABLES[SELF_TABLE].scope == "self"
    assert TABLES[GLOBAL_TABLE].scope == "global"
    assert TABLES[DIRECT_TABLE].scope == "direct"
    assert TABLES[VIA_TABLE].scope.startswith("via_")


# --- self scope: the row IS the user -------------------------------------


def test_self_scope_row_matches_on_id():
    assert row_belongs_to_user(SELF_TABLE, SimpleNamespace(id=USER), USER) is True
    assert row_belongs_to_user(SELF_TABLE, SimpleNamespace(id=OTHER), USER) is False


def test_self_scope_record_matches_on_id():
    assert record_belongs_to_user(SELF_TABLE, {"id": USER}, USER) is True
    assert record_belongs_to_user(SELF_TABLE, {"id": OTHER}, USER) is False


# --- global scope: shared, every user owns every row ---------------------


def test_global_scope_always_true_even_with_foreign_user_id():
    # Global models map no user_id, but a stray value must not flip it.
    assert row_belongs_to_user(GLOBAL_TABLE, SimpleNamespace(user_id=OTHER), USER) is True
    assert row_belongs_to_user(GLOBAL_TABLE, SimpleNamespace(), USER) is True
    assert record_belongs_to_user(GLOBAL_TABLE, {"user_id": OTHER}, USER) is True
    assert record_belongs_to_user(GLOBAL_TABLE, {}, USER) is True


# --- direct scope: inspect the user_id column ----------------------------


def test_direct_scope_matches_on_user_id():
    assert row_belongs_to_user(DIRECT_TABLE, SimpleNamespace(user_id=USER), USER) is True
    assert row_belongs_to_user(DIRECT_TABLE, SimpleNamespace(user_id=OTHER), USER) is False
    assert record_belongs_to_user(DIRECT_TABLE, {"user_id": USER}, USER) is True
    assert record_belongs_to_user(DIRECT_TABLE, {"user_id": OTHER}, USER) is False


# --- via_* scope: trust the parent FK (no direct user_id column) ----------


def test_via_scope_without_user_id_trusts_parent_fk():
    assert row_belongs_to_user(VIA_TABLE, SimpleNamespace(project_id="p1"), USER) is True
    assert record_belongs_to_user(VIA_TABLE, {"project_id": "p1"}, USER) is True


# --- the contested NULL-user_id case (the old divergence) ----------------


@pytest.mark.parametrize("table", [DIRECT_TABLE, VIA_TABLE])
def test_null_user_id_trusts_parent_fk(table):
    """A present-but-None user_id resolves to True (trust parent FK).

    This is the case where the old sync copy returned False (reject) and the
    old backup copy returned True (trust). The canonical function trusts the
    parent FK on both the ORM-row and the record-dict path -- the safe
    direction for restore (no silent data loss).
    """
    assert row_belongs_to_user(table, SimpleNamespace(user_id=None), USER) is True
    assert record_belongs_to_user(table, {"user_id": None}, USER) is True


# --- the two functions must never disagree on the same logical row -------


@pytest.mark.parametrize(
    ("table", "owner"),
    [
        (DIRECT_TABLE, USER),
        (DIRECT_TABLE, OTHER),
        (DIRECT_TABLE, None),
        (VIA_TABLE, None),
        (GLOBAL_TABLE, OTHER),
    ],
)
def test_row_and_record_agree(table, owner):
    row = SimpleNamespace(user_id=owner)
    record = {"user_id": owner}
    assert row_belongs_to_user(table, row, USER) == record_belongs_to_user(table, record, USER)


def test_self_row_and_record_agree():
    for ident in (USER, OTHER):
        row = SimpleNamespace(id=ident)
        record = {"id": ident}
        assert row_belongs_to_user(SELF_TABLE, row, USER) == record_belongs_to_user(
            SELF_TABLE, record, USER
        )
