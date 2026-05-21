"""Add user_streaks singleton for enhanced streaks (Phase 29C).

One row per user (unique ``user_id``) carrying freeze + weekend
mode + cached longest-streak counter. The live current_streak is
still derived from session activity; this table only holds the
state that can't be derived (freezes earned/used, weekend
preference).

Revision ID: 0011_user_streaks
Revises: 0010_badges
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_user_streaks"
down_revision: Union[str, Sequence[str], None] = "0010_badges"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_streaks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column(
            "freezes_available", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "last_freeze_earned_on",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_freeze_used_on",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "weekend_mode", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "current_streak_days",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "longest_streak_days",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_streaks_user"),
    )
    with op.batch_alter_table("user_streaks", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_user_streaks_user_id"), ["user_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("user_streaks", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_streaks_user_id"))
    op.drop_table("user_streaks")
