"""Add attempt-history columns to element_errors (#603 Smart Review Queue).

The review queue gets smarter about WHICH elements to resurface. To
distinguish "wrong" from "almost right" (needed a retry) from "correct
first try", and to show the learner their trajectory, each per-element
row now tracks:

- ``attempt_count`` — total attempts (correct or wrong), monotonic.
- ``attempt_history`` — a JSON ring buffer of the last 10 attempts
  (``[{"correct": bool, "hint_used": bool, "at": iso}, ...]``).

``attempt_count`` defaults to 0; ``attempt_history`` is nullable
(NULL = no recorded history yet), so existing rows need no backfill.

Revision ID: 0031_element_errors_attempt_history
Revises: 0030_element_errors_hint_economy
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_element_errors_attempt_history"
down_revision: Union[str, Sequence[str], None] = "0030_element_errors_hint_economy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the attempt_count + attempt_history columns."""
    with op.batch_alter_table("element_errors") as batch:
        batch.add_column(
            sa.Column(
                "attempt_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.add_column(
            sa.Column("attempt_history", sa.Text(), nullable=True)
        )


def downgrade() -> None:
    """Drop the attempt-history columns."""
    with op.batch_alter_table("element_errors") as batch:
        batch.drop_column("attempt_history")
        batch.drop_column("attempt_count")
