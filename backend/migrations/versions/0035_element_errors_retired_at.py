"""Add retired_at column to element_errors (#2188 retired_ids archival).

An author retires an exercise/card via the set manifest's ``retired_ids``
list (engine#90 stability gate). The learner's rows for a retired identity
are ARCHIVED, not deleted (architect decision on #2188, 2026-07-31): they
keep the history (the #2125 error-history input) but leave review
scheduling and due counts.

- ``retired_at`` — when the archive path marked the row; NULL = active.

Nullable with no default, so existing rows need no backfill.

Revision ID: 0035_element_errors_retired_at
Revises: 0034_element_errors_exam_boost
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0035_element_errors_retired_at"
down_revision: Union[str, Sequence[str], None] = "0034_element_errors_exam_boost"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the retired_at column."""
    with op.batch_alter_table("element_errors") as batch:
        batch.add_column(
            sa.Column(
                "retired_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )


def downgrade() -> None:
    """Drop the retired_at column."""
    with op.batch_alter_table("element_errors") as batch:
        batch.drop_column("retired_at")
