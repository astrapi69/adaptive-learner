"""Add badges + user_badges for gamification (Phase 29B).

Two new tables. ``badges`` is the catalog (seeded from
``plugins/adaptive-learner-plugin-gamification/badges.yaml`` on
first startup); ``user_badges`` is the earned-badge record.

Revision ID: 0010_badges
Revises: 0009_user_xp
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_badges"
down_revision: Union[str, Sequence[str], None] = "0009_user_xp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "badges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("name_key", sa.String(length=200), nullable=False),
        sa.Column("description_key", sa.String(length=200), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False, server_default=""),
        sa.Column(
            "category", sa.String(length=50), nullable=False, server_default="general"
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_badges_key"),
    )
    with op.batch_alter_table("badges", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_badges_key"), ["key"], unique=False)

    op.create_table(
        "user_badges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("badge_id", sa.String(length=36), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["badge_id"], ["badges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "badge_id", name="uq_user_badges_pair"),
    )
    with op.batch_alter_table("user_badges", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_user_badges_user_id"), ["user_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_user_badges_badge_id"), ["badge_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("user_badges", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_badges_badge_id"))
        batch_op.drop_index(batch_op.f("ix_user_badges_user_id"))
    op.drop_table("user_badges")

    with op.batch_alter_table("badges", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_badges_key"))
    op.drop_table("badges")
