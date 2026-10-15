"""Add run_time_seconds to lesson_progress (#3747).

``time_spent_seconds`` sums every visit of a lesson across restarts; the
summary showed it as the time of the run just finished. The new column
counts the current run only and starts over on a restart or an abandon.

Existing rows take their lifetime total, the value the summary showed until
now, so no summary changes for a row that was never restarted after this.

Revision ID: 0041_lesson_progress_run_time
Revises: 0040_xp_purchases
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041_lesson_progress_run_time"
down_revision: Union[str, Sequence[str], None] = "0040_xp_purchases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add run_time_seconds and backfill it from time_spent_seconds."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.add_column(
            sa.Column(
                "run_time_seconds",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
    op.execute("UPDATE lesson_progress SET run_time_seconds = time_spent_seconds")


def downgrade() -> None:
    """Drop run_time_seconds."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("run_time_seconds")
