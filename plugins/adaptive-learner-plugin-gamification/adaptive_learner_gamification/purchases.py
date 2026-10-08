"""XP purchase ledger (#3445).

An XP purchase (an avatar frame, a mascot variant, an arcade game) is one
event: the ``UserXP`` deduction and the ``XpPurchase`` row are written in
the same transaction, and ownership is derived from the rows. Before, the
deduction rode sync and backup while ownership lived only in the browser's
localStorage, so a second browser, cleared site data or a paired device
showed the XP spent and the item not owned.

The row id is a uuid5 of ``(user_id, item_kind, item_id)``. The same
purchase is therefore the same row on every device and in both storage
modes (the browser derives it with the same namespace), so sync skips a
known id instead of hitting the unique key, and the one-time localStorage
migration (``already_paid``) can repeat without adding a second row.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from app.exceptions import ValidationError

from .xp_service import _get_or_create_user_xp, compute_level, get_user_xp_state

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

PURCHASE_ID_NAMESPACE = uuid.UUID("6f1c2a52-5d2e-4c1b-9a43-8f0e3b7d9c10")

ITEM_KINDS = frozenset({"avatar_frame", "mascot_variant", "arcade_game"})


def purchase_id(user_id: str, item_kind: str, item_id: str) -> str:
    """The deterministic row id of one purchase.

    Args:
        user_id: The buyer.
        item_kind: One of :data:`ITEM_KINDS`.
        item_id: The catalog id within that kind.

    Returns:
        ``uuid5(PURCHASE_ID_NAMESPACE, "<user>:<kind>:<item>")`` as a string;
        ``frontend/src/lib/gamification/purchase-id.ts`` computes the same.
    """
    return str(uuid.uuid5(PURCHASE_ID_NAMESPACE, f"{user_id}:{item_kind}:{item_id}"))


def _serialize(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "item_kind": row.item_kind,
        "item_id": row.item_id,
        "cost": row.cost,
        "purchased_at": row.purchased_at.isoformat() if row.purchased_at else None,
    }


def purchase_item(
    db: Session,
    *,
    user_id: str,
    item_kind: str,
    item_id: str,
    cost: int,
    already_paid: bool = False,
) -> dict[str, Any]:
    """Record a purchase and deduct its cost in one transaction.

    A purchase that is already recorded charges nothing and adds no row,
    so a retried request or a second device can never pay twice.

    Args:
        db: SQLAlchemy session.
        user_id: The buyer.
        item_kind: One of :data:`ITEM_KINDS`.
        item_id: The catalog id within that kind.
        cost: The XP price, recorded with the purchase.
        already_paid: Record without deducting; the one-time migration of
            items bought before the ledger existed, whose XP was already
            taken.

    Returns:
        ``{"xp": <XP state>, "purchase": <row>}``.

    Raises:
        ValidationError: unknown ``item_kind``, a negative cost, or a
            balance below ``cost`` (the previous spend clamped at 0 and
            would have handed the item over for free).
    """
    from app.models import XpPurchase

    if item_kind not in ITEM_KINDS:
        raise ValidationError(f"Unknown purchase kind {item_kind!r}")
    price = int(cost)
    if price < 0:
        raise ValidationError(f"Purchase cost must not be negative, got {price}")
    row_id = purchase_id(user_id, item_kind, item_id)
    existing = db.get(XpPurchase, row_id)
    if existing is not None:
        return {"xp": get_user_xp_state(db, user_id), "purchase": _serialize(existing)}
    if not already_paid:
        xp = _get_or_create_user_xp(db, user_id)
        if int(xp.total_xp) < price:
            raise ValidationError(
                f"Not enough XP for {item_kind} {item_id!r}: {xp.total_xp} < {price}"
            )
        xp.total_xp = int(xp.total_xp) - price
        xp.level = compute_level(xp.total_xp)
    row = XpPurchase(id=row_id, user_id=user_id, item_kind=item_kind, item_id=item_id, cost=price)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"xp": get_user_xp_state(db, user_id), "purchase": _serialize(row)}


def list_purchases(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Every purchase of ``user_id``, oldest first."""
    from app.models import XpPurchase

    rows = (
        db.query(XpPurchase)
        .filter(XpPurchase.user_id == user_id)
        .order_by(XpPurchase.purchased_at, XpPurchase.id)
        .all()
    )
    return [_serialize(row) for row in rows]
