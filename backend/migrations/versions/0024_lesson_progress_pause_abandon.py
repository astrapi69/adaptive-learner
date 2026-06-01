"""Add paused_at and abandoned_at to lesson_progress (Phase 63A / EXP-020).

Phase 63 introduces lesson lifecycle states beyond ``in_progress`` /
``completed``: a user can pause a lesson (saving everything for later
resume) or abandon it (discarding the attempt but keeping any
ElementErrors that were already recorded). Both transitions need a
timestamp so the dashboard widget can show "paused 2 days ago" and
the 30-day cleanup job can pick stale rows.

The ``status`` column already widens implicitly — it is a free
``String(20)`` with no enum constraint — so no schema change is
needed for the new values themselves.

Revision ID: 0024_lesson_progress_pause_abandon
Revises: 0023_element_error_direction
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_lesson_progress_pause_abandon"
down_revision: Union[str, Sequence[str], None] = "0023_element_error_direction"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable paused_at + abandoned_at timestamps."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.add_column(
            sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        )
        batch.add_column(
            sa.Column(
                "abandoned_at", sa.DateTime(timezone=True), nullable=True
            ),
        )


def downgrade() -> None:
    """Drop the two timestamps."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("abandoned_at")
        batch.drop_column("paused_at")
