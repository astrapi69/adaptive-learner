"""XP purchases are one recorded event, not a balance change plus a local flag (#3445).

Before: buying an avatar frame, a mascot variant or an arcade game lowered
``user_xp.total_xp`` (which rides sync and backup) while ownership lived only
in the browser's localStorage. A second browser, cleared site data or a
paired device showed the XP spent and the item not owned.

Now a purchase is a row in ``xp_purchases``, written in the same transaction
as the deduction, and ownership is derived from it. Its id is a uuid5 of
(user, kind, item), so the same purchase is the same row on every device:
sync skips it instead of hitting the unique key, and the localStorage
migration can repeat without creating a second row.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from adaptive_learner_gamification.purchases import (
    PURCHASE_ID_NAMESPACE,
    purchase_id,
)
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import User, UserXP, XpPurchase
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.repositories.sync_repo import SqlAlchemySyncRepository
from app.services.backup_export import create_backup
from app.services.backup_restore import restore_backup
from app.services.sync_push import push_records

BASE = "/api/plugins/gamification/xp"


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _user_with_xp(client: TestClient, xp: int) -> str:
    user_id = client.post("/api/users", json={"name": "Buyer"}).json()["id"]
    db = SessionLocal()
    try:
        db.add(UserXP(user_id=user_id, total_xp=xp, level=1))
        db.commit()
    finally:
        db.close()
    return user_id


def _buy(client: TestClient, user_id: str, item_id: str, cost: int, **extra):
    return client.post(
        f"{BASE}/{user_id}/purchases",
        json={"item_kind": "avatar_frame", "item_id": item_id, "cost": cost, **extra},
    )


def _rows(user_id: str) -> list[XpPurchase]:
    db = SessionLocal()
    try:
        return db.query(XpPurchase).filter(XpPurchase.user_id == user_id).all()
    finally:
        db.close()


def test_purchase_deducts_and_records_in_one_event(client: TestClient) -> None:
    user_id = _user_with_xp(client, 400)
    r = _buy(client, user_id, "star", 150)
    assert r.status_code == 200, r.text
    assert r.json()["xp"]["total_xp"] == 250
    rows = _rows(user_id)
    assert [(p.item_kind, p.item_id, p.cost) for p in rows] == [("avatar_frame", "star", 150)]
    assert rows[0].id == purchase_id(user_id, "avatar_frame", "star")


def test_repeating_a_purchase_charges_once(client: TestClient) -> None:
    user_id = _user_with_xp(client, 400)
    _buy(client, user_id, "star", 150)
    again = _buy(client, user_id, "star", 150)
    assert again.status_code == 200
    assert again.json()["xp"]["total_xp"] == 250
    assert len(_rows(user_id)) == 1


@pytest.mark.parametrize(
    ("balance", "cost", "status", "rows"),
    [(149, 150, 400, 0), (150, 150, 200, 1)],
    ids=["one-below-cost", "exactly-the-cost"],
)
def test_affordability_boundary(
    client: TestClient, balance: int, cost: int, status: int, rows: int
) -> None:
    user_id = _user_with_xp(client, balance)
    assert _buy(client, user_id, "star", cost).status_code == status
    assert len(_rows(user_id)) == rows


def test_already_paid_records_without_charging_and_only_once(client: TestClient) -> None:
    """The localStorage migration: an item bought before the ledger existed."""
    user_id = _user_with_xp(client, 100)
    for _ in range(2):
        r = _buy(client, user_id, "accent", 300, already_paid=True)
        assert r.status_code == 200, r.text
        assert r.json()["xp"]["total_xp"] == 100
    assert len(_rows(user_id)) == 1


def test_list_purchases_returns_the_ledger(client: TestClient) -> None:
    user_id = _user_with_xp(client, 1000)
    _buy(client, user_id, "star", 150)
    _buy(client, user_id, "accent", 300)
    listed = client.get(f"{BASE}/{user_id}/purchases").json()
    assert sorted(p["item_id"] for p in listed) == ["accent", "star"]


def test_unknown_item_kind_is_rejected(client: TestClient) -> None:
    user_id = _user_with_xp(client, 400)
    r = client.post(
        f"{BASE}/{user_id}/purchases",
        json={"item_kind": "spaceship", "item_id": "x", "cost": 10},
    )
    assert r.status_code == 400
    assert _rows(user_id) == []


def test_backup_restore_brings_back_ownership_and_balance(client: TestClient) -> None:
    user_id = _user_with_xp(client, 400)
    _buy(client, user_id, "star", 150)
    db = SessionLocal()
    try:
        payload = create_backup(SqlAlchemyBackupRepository(db), user_id)
        assert [r["item_id"] for r in payload["data"]["xp_purchases"]] == ["star"]
        db.query(XpPurchase).delete()
        db.query(UserXP).delete()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()
        restore_backup(SqlAlchemyBackupRepository(db), payload)
        assert [p.item_id for p in db.query(XpPurchase).filter_by(user_id=user_id)] == ["star"]
        assert db.query(UserXP).filter_by(user_id=user_id).one().total_xp == 250
    finally:
        db.close()


def test_the_same_purchase_from_another_device_is_skipped_not_a_conflict(
    client: TestClient,
) -> None:
    user_id = _user_with_xp(client, 400)
    _buy(client, user_id, "star", 150)
    remote = {
        "id": purchase_id(user_id, "avatar_frame", "star"),
        "user_id": user_id,
        "item_kind": "avatar_frame",
        "item_id": "star",
        "cost": 150,
        "purchased_at": datetime.now(UTC).isoformat(),
    }
    db = SessionLocal()
    try:
        result = push_records(SqlAlchemySyncRepository(db), user_id, "xp_purchases", [remote], None)
    finally:
        db.close()
    assert result.accepted == []
    assert result.skipped == [remote["id"]]
    assert len(_rows(user_id)) == 1


def test_purchase_id_matches_the_browser_vector() -> None:
    """Same input, same id in both storage modes (the TS side pins this vector)."""
    assert PURCHASE_ID_NAMESPACE == uuid.UUID("6f1c2a52-5d2e-4c1b-9a43-8f0e3b7d9c10")
    assert purchase_id("user-1", "avatar_frame", "star") == str(
        uuid.uuid5(PURCHASE_ID_NAMESPACE, "user-1:avatar_frame:star")
    )
