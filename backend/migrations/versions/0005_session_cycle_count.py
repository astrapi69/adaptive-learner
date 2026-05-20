"""Add cycle_count + cycle_topics columns to learning_sessions.

Phase 17B — v1.4.0 auto-loop feature. ``cycle_count`` starts at 1
and increments when the topic-transition evaluator advances the
session to a new subtopic. ``cycle_topics`` stores a JSON array
of summaries, one entry per completed cycle.

Revision ID: 0005_session_cycle_count
Revises: 0004_imported_conversations
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_session_cycle_count"
down_revision: Union[str, Sequence[str], None] = "0004_imported_conversations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("learning_sessions") as batch:
        batch.add_column(
            sa.Column(
                "cycle_count",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )
        batch.add_column(
            sa.Column(
                "cycle_topics",
                sa.Text(),
                nullable=False,
                server_default="[]",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("learning_sessions") as batch:
        batch.drop_column("cycle_topics")
        batch.drop_column("cycle_count")
