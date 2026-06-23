"""Add lesson_mode to lesson_progress (#1007 Phase 2).

A lesson can be played in different modes (``practice`` | ``exam`` |
``timed`` | …). The mode is now persisted on the attempt so the
server-side XP award can apply the mode reward weight (exam = 1.5×)
and the SRS layer can weight passed exam items.

Additive with ``server_default = 'practice'`` so existing rows need
no backfill (a pre-Phase-2 lesson reports ``practice``).

Revision ID: 0033_lesson_progress_lesson_mode
Revises: 0032_lesson_progress_retry_tracking
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033_lesson_progress_lesson_mode"
down_revision: Union[str, Sequence[str], None] = "0032_lesson_progress_retry_tracking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the lesson_mode column (default 'practice')."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.add_column(
            sa.Column(
                "lesson_mode",
                sa.String(length=20),
                nullable=False,
                server_default="practice",
            )
        )


def downgrade() -> None:
    """Drop the lesson_mode column."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("lesson_mode")
