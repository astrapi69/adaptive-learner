"""Add current_step to lesson_progress (BUG #41 — resume at paused step).

A paused lesson restarted from step 1 because the resume position was
reconstructed solely from ``step_results``, which only records *graded
exercise* steps. Theory steps (and the current, not-yet-answered
exercise) write no result, so the navigation position was lost on
pause. This adds an explicit ``current_step`` integer the viewer
persists on every autosave / step / pause, and reads on resume.

Non-nullable with a server default of 0 so existing rows backfill to
"start of lesson" (the old behaviour) without a data migration.

Revision ID: 0027_lesson_progress_current_step
Revises: 0026_imported_conversation_languages
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027_lesson_progress_current_step"
down_revision: Union[str, Sequence[str], None] = "0026_imported_conversation_languages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add a non-null current_step with a server default of 0."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.add_column(
            sa.Column(
                "current_step",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
        )


def downgrade() -> None:
    """Drop current_step."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("current_step")
