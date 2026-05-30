"""Add drill direction to element_errors (EXP-018 / Phase 62 / v1.46.0).

Every exercise now carries a ``direction`` (receptive vs productive);
the SRS tracks mastery PER direction. ``element_errors`` gains a
``direction`` column and the per-element uniqueness grows to include
it, so a single card can hold two independent rows:

  - ``target_to_source`` (receptive — show target, recognise source)
  - ``source_to_target`` (productive — show source, produce target)

Backfill: every existing row was recorded under the pre-62 implicit
behaviour, which was receptive, so existing rows get
``direction = "target_to_source"`` via the column ``server_default``.
The unique constraint is renamed
``uq_element_errors_user_element`` -> ``uq_element_errors_user_element_direction``
and gains ``direction`` as its sixth column.

SQLite cannot ALTER a constraint in place, so this runs inside a
``batch_alter_table`` (table recreate); ``render_as_batch=True`` is
already set in ``migrations/env.py``.

Revision ID: 0023_element_error_direction
Revises: 0022_badge_tiers
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_element_error_direction"
down_revision: Union[str, Sequence[str], None] = "0022_badge_tiers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_UNIQUE = "uq_element_errors_user_element"
_NEW_UNIQUE = "uq_element_errors_user_element_direction"
_KEY_COLUMNS = ["user_id", "set_id", "lesson_id", "exercise_id", "element_key"]


def upgrade() -> None:
    with op.batch_alter_table("element_errors", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "direction",
                sa.String(length=20),
                nullable=False,
                server_default="target_to_source",
            )
        )
        batch_op.drop_constraint(_OLD_UNIQUE, type_="unique")
        batch_op.create_unique_constraint(_NEW_UNIQUE, [*_KEY_COLUMNS, "direction"])

    # Drop the server_default now that existing rows are backfilled;
    # new rows get their value from the ORM model default. Keeping a
    # server_default is harmless but the model is the source of truth.
    with op.batch_alter_table("element_errors", schema=None) as batch_op:
        batch_op.alter_column("direction", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("element_errors", schema=None) as batch_op:
        batch_op.drop_constraint(_NEW_UNIQUE, type_="unique")
        batch_op.create_unique_constraint(_OLD_UNIQUE, _KEY_COLUMNS)
        batch_op.drop_column("direction")
