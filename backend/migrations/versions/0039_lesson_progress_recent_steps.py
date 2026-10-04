"""Add recent_steps to lesson_progress (#3365).

The row keeps the last ten learner actions (arriving on a step, a graded
answer, pause, exit, restart, reaching the summary) as a JSON list, so a
resume can land on the step the learner was last on by its id, not only
by an index that shifts when the lesson changes.

Additive with ``server_default = '[]'`` so existing rows need no backfill
(a pre-#3365 row resumes by the old rule).

Revision ID: 0039_lesson_progress_recent_steps
Revises: 0038_speech_recordings
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039_lesson_progress_recent_steps"
down_revision: Union[str, Sequence[str], None] = "0038_speech_recordings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the recent_steps column (default empty list)."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.add_column(
            sa.Column(
                "recent_steps",
                sa.Text(),
                nullable=False,
                server_default="[]",
            )
        )


def downgrade() -> None:
    """Drop the recent_steps column."""
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("recent_steps")
