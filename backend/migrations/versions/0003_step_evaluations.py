"""Create step_evaluations table for v0.5.0 dual-prompt analytics.

Phase 8D — every successful /message round-trip writes one row
recording the evaluator's verdict + the route's derived
``applied`` decision. The 8D tracking aggregates read this table
to surface average confidence per session, count of
"not-ready-yet" repeats, and time-per-step.

Revision ID: 0003_step_evaluations
Revises: 0002_user_settings_model_override
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# Alembic identifiers.
revision: str = "0003_step_evaluations"
down_revision: Union[str, Sequence[str], None] = "0002_user_settings_model_override"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "step_evaluations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(length=36),
            sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_step", sa.Integer(), nullable=False),
        sa.Column("to_step", sa.Integer(), nullable=False),
        sa.Column("advance", sa.Boolean(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("applied", sa.Boolean(), nullable=False),
        sa.Column(
            "fallback_used",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "evaluated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_step_evaluations_session_id",
        "step_evaluations",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_step_evaluations_session_id", table_name="step_evaluations")
    op.drop_table("step_evaluations")
