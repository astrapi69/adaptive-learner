"""Add retired_reason to element_errors (#3952).

``retired_at`` said that a row left review scheduling, not why. Until now
the only cause was the author's ``retired_ids`` (#2188). #3952 adds a second
kind: rows whose exercise or lesson the installed set no longer holds. The
reason tells the two apart.

Rows already retired were retired by an author and take "author".

Revision ID: 0042_element_errors_retired_reason
Revises: 0041_lesson_progress_run_time
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0042_element_errors_retired_reason"
down_revision: Union[str, Sequence[str], None] = "0041_lesson_progress_run_time"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add retired_reason and mark the rows retired so far as author-retired."""
    with op.batch_alter_table("element_errors") as batch:
        batch.add_column(sa.Column("retired_reason", sa.String(length=32), nullable=True))
    op.execute("UPDATE element_errors SET retired_reason = 'author' WHERE retired_at IS NOT NULL")


def downgrade() -> None:
    """Drop the retired_reason column."""
    with op.batch_alter_table("element_errors") as batch:
        batch.drop_column("retired_reason")
