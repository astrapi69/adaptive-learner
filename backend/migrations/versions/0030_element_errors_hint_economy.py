"""Add hint-economy columns to element_errors (#594 Hint Economy).

A learner can reveal a staged hint before answering. A hint-assisted
answer is weaker, so the SRS layer shortens the review interval; the
event is also counted for the "answers with hint" statistic. Two new
columns track this on each per-element row:

- ``hint_used`` — whether the MOST RECENT attempt used a hint (drives
  the shortened interval).
- ``hint_used_count`` — lifetime count of hint-assisted attempts.

Both default to a safe zero so existing rows need no backfill.

Revision ID: 0030_element_errors_hint_economy
Revises: 0029_user_settings_avatar
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_element_errors_hint_economy"
down_revision: Union[str, Sequence[str], None] = "0029_user_settings_avatar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the hint_used + hint_used_count columns."""
    with op.batch_alter_table("element_errors") as batch:
        batch.add_column(
            sa.Column(
                "hint_used",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.add_column(
            sa.Column(
                "hint_used_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )


def downgrade() -> None:
    """Drop the hint-economy columns."""
    with op.batch_alter_table("element_errors") as batch:
        batch.drop_column("hint_used_count")
        batch.drop_column("hint_used")
