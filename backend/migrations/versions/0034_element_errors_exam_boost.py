"""Add exam-boost column to element_errors (#1040 Exam-Mode SRS boost).

Phase 2 of #1007. A card answered correctly in EXAM mode is stronger
retention evidence than a practice-mode correct answer, so the SRS layer
lengthens the next-review interval (the inverse of the #594 hint factor).
One new column tracks this on each per-element row:

- ``last_attempt_exam`` — whether the MOST RECENT attempt was a CORRECT
  exam answer (drives the lengthened interval in ``element_srs._project``).

Defaults to a safe zero so existing rows need no backfill.

Revision ID: 0034_element_errors_exam_boost
Revises: 0033_lesson_progress_lesson_mode
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034_element_errors_exam_boost"
down_revision: Union[str, Sequence[str], None] = "0033_lesson_progress_lesson_mode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the last_attempt_exam column."""
    with op.batch_alter_table("element_errors") as batch:
        batch.add_column(
            sa.Column(
                "last_attempt_exam",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )


def downgrade() -> None:
    """Drop the exam-boost column."""
    with op.batch_alter_table("element_errors") as batch:
        batch.drop_column("last_attempt_exam")
