"""Add user_xp singleton for gamification (Phase 29A).

One row per user (unique ``user_id``) carrying ``total_xp`` and
the derived ``level``. The gamification plugin owns the write
path; this migration only creates the table.

Revision ID: 0009_user_xp
Revises: 0008_subjects_tags
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_user_xp"
down_revision: Union[str, Sequence[str], None] = "0008_subjects_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_xp",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("total_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_xp_user"),
    )
    with op.batch_alter_table("user_xp", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_user_xp_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("user_xp", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_xp_user_id"))
    op.drop_table("user_xp")
