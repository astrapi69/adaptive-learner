"""Add user_missions (EXP-010 / Phase 56 / P-155, P-156).

The one new tracking table the daily-missions feature adds. The
mission CATALOG is static config (``config/plugins/missions.yaml``,
validated by the ``MissionTemplate`` Pydantic schema); only the
per-user, per-day assignment + progress lives in the DB. A UNIQUE
constraint on ``(user_id, template_id, assigned_date)`` makes
upserts converge through either storage backend.

Revision ID: 0021_user_missions
Revises: 0020_learning_project_kind
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021_user_missions"
down_revision: Union[str, Sequence[str], None] = "0020_learning_project_kind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_missions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("assigned_date", sa.Date(), nullable=False, index=True),
        sa.Column(
            "progress", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "completed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "xp_awarded",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "template_id",
            "assigned_date",
            name="uq_user_missions_user_template_date",
        ),
    )


def downgrade() -> None:
    op.drop_table("user_missions")
