"""Regression test for issue #49 — backup restore UNIQUE on badges.key.

Badges are a seeded catalog with a RANDOM ``id`` per install and a
UNIQUE ``key``. Restoring a backup onto a DB whose badges were seeded
with DIFFERENT ids used to crash with
``sqlite3.IntegrityError: UNIQUE constraint failed: badges.key`` (the
id lookup missed, the insert collided on key). The fix matches seeded
catalog rows by their natural key and remaps child FKs
(``user_badges.badge_id``) to the local id.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.models import Badge, User, UserBadge
from app.services.backup_service import create_backup, restore_backup


@pytest.fixture()
def db():
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _now() -> datetime:
    return datetime.now(UTC)


def _make_badge(db, *, badge_id: str, key: str) -> Badge:
    badge = Badge(
        id=badge_id,
        key=key,
        name_key=f"{key}.name",
        description_key=f"{key}.desc",
        icon="star",
        category="general",
        base_tier="bronze",
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(badge)
    return badge


def test_restore_remaps_badges_by_key_no_unique_crash(db) -> None:
    user = User(name="Aster", email=None, language="de")
    db.add(user)
    db.flush()

    # Install A: catalog seeded under ids old-1 / old-2; user earned old-1.
    _make_badge(db, badge_id="old-1", key="first_lesson")
    _make_badge(db, badge_id="old-2", key="streak_3")
    db.add(
        UserBadge(
            id="ub-1",
            user_id=user.id,
            badge_id="old-1",
            tier="bronze",
            earned_at=_now(),
            updated_at=_now(),
        )
    )
    db.commit()

    payload = create_backup(db, user.id)

    # Simulate a different install / re-seed: same keys, NEW ids.
    db.query(UserBadge).delete()
    db.query(Badge).delete()
    db.commit()
    _make_badge(db, badge_id="new-1", key="first_lesson")
    _make_badge(db, badge_id="new-2", key="streak_3")
    db.commit()

    # Must not raise UNIQUE constraint failed: badges.key.
    summary = restore_backup(db, payload)
    assert not summary["errors"], summary["errors"]

    # Catalog: exactly 2 badges, not duplicated, LOCAL ids preserved.
    badges = {b.key: b.id for b in db.query(Badge).all()}
    assert badges == {"first_lesson": "new-1", "streak_3": "new-2"}

    # The earned badge survived and now references the LOCAL badge id
    # (old-1 remapped to new-1) — referential integrity preserved.
    earned = db.query(UserBadge).filter(UserBadge.user_id == user.id).all()
    assert len(earned) == 1
    assert earned[0].badge_id == "new-1"


def test_restore_same_install_badges_unchanged(db) -> None:
    """Same-install round-trip: ids already match, no remap, no dupes."""
    user = User(name="Aster", email=None, language="de")
    db.add(user)
    db.flush()
    _make_badge(db, badge_id="b-1", key="first_lesson")
    db.add(
        UserBadge(
            id="ub-1",
            user_id=user.id,
            badge_id="b-1",
            tier="bronze",
            earned_at=_now(),
            updated_at=_now(),
        )
    )
    db.commit()

    payload = create_backup(db, user.id)
    summary = restore_backup(db, payload)
    assert not summary["errors"], summary["errors"]
    assert [b.id for b in db.query(Badge).all()] == ["b-1"]
    earned = db.query(UserBadge).filter(UserBadge.user_id == user.id).all()
    assert len(earned) == 1 and earned[0].badge_id == "b-1"
