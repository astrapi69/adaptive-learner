"""Add badge tiers (Phase 57 / v1.40.0 / P-158).

Three-tier badges (bronze/silver/gold). No catalog keys are removed or
merged - all 28 shipped keys stay. Two new shapes:

- ``badges`` gains ``base_tier`` (the badge's fixed visual tier) and
  ``tier_thresholds`` (JSON for DYNAMIC badges whose single row upgrades
  as a metric grows; NULL for static/flat badges). Both are seeded from
  badges.yaml on boot; this migration only adds the columns with safe
  defaults.
- ``user_badges`` gains ``tier`` and ``updated_at``. The table becomes
  MUTABLE (was append-only) because a dynamic badge's tier climbs in
  place. ``tier`` is a high-water mark and never demotes.

Backfill maps the EXISTING sibling badges to their fixed visual tier so
the gallery renders them as one bronze->silver->gold progression while
they stay separate rows:

  sessions_10/50/100  -> bronze/silver/gold
  level_5/10/25       -> bronze/silver/gold
  streak_3/7/30/100   -> bronze/silver/gold/gold (streak_100 = legendary)

Every other earned badge stays bronze (the column default). No row is
deleted, remapped, or merged - zero data loss, zero breaking change.

Revision ID: 0022_badge_tiers
Revises: 0021_user_missions
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_badge_tiers"
down_revision: Union[str, Sequence[str], None] = "0021_user_missions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Static visual-tier map for the existing sibling families. Keys NOT
# listed here keep the column default ("bronze"). Mirrored in
# badges.yaml ``base_tier`` and in the Dexie v21 upgrade.
_SILVER_KEYS = ("sessions_50", "level_10", "streak_7_days")
_GOLD_KEYS = ("sessions_100", "level_25", "streak_30_days", "streak_100_days")


def upgrade() -> None:
    # --- badges catalog: tier metadata (seeder fills the values) -------
    op.add_column(
        "badges",
        sa.Column(
            "base_tier",
            sa.String(length=10),
            nullable=False,
            server_default="bronze",
        ),
    )
    op.add_column(
        "badges",
        sa.Column("tier_thresholds", sa.Text(), nullable=True),
    )

    # --- user_badges: per-earn tier + mutability ----------------------
    op.add_column(
        "user_badges",
        sa.Column(
            "tier",
            sa.String(length=10),
            nullable=False,
            server_default="bronze",
        ),
    )
    op.add_column(
        "user_badges",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Backfill updated_at = earned_at for existing rows.
    op.execute("UPDATE user_badges SET updated_at = earned_at WHERE updated_at IS NULL")

    # Backfill the sibling badges' visual tier (defensive: no-op when the
    # catalog rows / earned rows are absent, e.g. on a fresh test DB).
    _backfill_sibling_tiers(_SILVER_KEYS, "silver")
    _backfill_sibling_tiers(_GOLD_KEYS, "gold")


def _backfill_sibling_tiers(keys: Sequence[str], tier: str) -> None:
    key_list = ", ".join(f"'{key}'" for key in keys)
    op.execute(
        f"""
        UPDATE user_badges
        SET tier = '{tier}'
        WHERE badge_id IN (SELECT id FROM badges WHERE key IN ({key_list}))
        """
    )


def downgrade() -> None:
    op.drop_column("user_badges", "updated_at")
    op.drop_column("user_badges", "tier")
    op.drop_column("badges", "tier_thresholds")
    op.drop_column("badges", "base_tier")
