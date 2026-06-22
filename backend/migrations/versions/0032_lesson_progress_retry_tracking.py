"""Add retry/improvement tracking to lesson_progress (#983).

Completed lessons can be practised again. Each completion is an attempt;
the row now keeps the running count + the highest-percentage attempt +
a bounded history so the learner can see their improvement and progress
surfaces show the BEST score, not the last:

- ``attempts`` — number of completed attempts, monotonic.
- ``best_score_correct`` / ``best_score_total`` — the highest-percentage
  completed attempt's raw score.
- ``attempt_history`` — a JSON list of ``{"at": iso, "correct": int,
  "total": int}`` entries (capped on write).

All default so existing rows need no backfill (a never-retried lesson
reports ``attempts = 0`` / empty history; the service backfills the
first attempt + best score on the next completion).

Revision ID: 0032_lesson_progress_retry_tracking
Revises: 0031_element_errors_attempt_history
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032_lesson_progress_retry_tracking"
down_revision: Union[str, Sequence[str], None] = "0031_element_errors_attempt_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the attempts / best_score / attempt_history columns."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.add_column(
            sa.Column(
                "attempts",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.add_column(
            sa.Column(
                "best_score_correct",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.add_column(
            sa.Column(
                "best_score_total",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.add_column(
            sa.Column(
                "attempt_history",
                sa.Text(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )


def downgrade() -> None:
    """Drop the retry-tracking columns."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("attempt_history")
        batch.drop_column("best_score_total")
        batch.drop_column("best_score_correct")
        batch.drop_column("attempts")
