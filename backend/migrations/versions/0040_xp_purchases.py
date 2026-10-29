"""Add the xp_purchases ledger (#3445).

An XP purchase (an avatar frame, a mascot variant, an arcade game) used
to lower user_xp.total_xp while ownership lived only in the browser's
localStorage, so a second browser, cleared site data or a paired device
showed the XP spent and the item not owned. The ledger records each
purchase as one row next to the deduction; ownership is derived from it.

The row id is a uuid5 of (user, kind, item), so the same purchase is the
same row on every device. Unique on (user_id, item_kind, item_id).

Revision ID: 0040_xp_purchases
Revises: 0039_lesson_progress_recent_steps
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040_xp_purchases"
down_revision: Union[str, Sequence[str], None] = "0039_lesson_progress_recent_steps"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the xp_purchases table."""
    op.create_table(
        "xp_purchases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("item_kind", sa.String(length=32), nullable=False),
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "item_kind", "item_id", name="uq_xp_purchases_item"),
    )


def downgrade() -> None:
    """Drop the xp_purchases table."""
    op.drop_table("xp_purchases")
