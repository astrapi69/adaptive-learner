"""Add Durchgang (run/pass) generation to element_errors + set_runs table
(EXP-051 / #2125).

A learner can rework a finished set as a *second* run without overwriting
the first: ``element_errors`` gains a ``run_id`` generation column and its
per-element uniqueness grows to include it, so the same card holds one row
per run. A new ``set_runs`` table records WHICH run of each ``(user, set)``
is active (``closed_at IS NULL``).

Backfill: every existing row was recorded under the implicit first run, so
it gets ``run_id = 1`` via the column ``server_default`` — no backfill
script, and old ``.alb`` backups without the field import as run 1 too. No
``set_runs`` rows are created here; the first read/write after the upgrade
lazily materialises the implicit active run 1.

SQLite cannot ALTER a constraint in place, so the constraint change runs
inside a ``batch_alter_table`` (table recreate); ``render_as_batch=True`` is
already set in ``migrations/env.py``. The precedent is
``0023_element_error_direction`` (which added ``direction`` to the same
constraint the same way).

Revision ID: 0037_element_errors_run_id_set_runs
Revises: 0036_user_settings_perplexity
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0037_element_errors_run_id_set_runs"
down_revision: Union[str, Sequence[str], None] = "0036_user_settings_perplexity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UNIQUE = "uq_element_errors_user_element_direction"
_KEY_COLUMNS = [
    "user_id",
    "set_id",
    "lesson_id",
    "exercise_id",
    "element_key",
    "direction",
]


def upgrade() -> None:
    """Add ``run_id`` to element_errors (in the unique key) + set_runs."""
    with op.batch_alter_table("element_errors", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "run_id",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )
        batch_op.drop_constraint(_UNIQUE, type_="unique")
        batch_op.create_unique_constraint(_UNIQUE, [*_KEY_COLUMNS, "run_id"])

    op.create_table(
        "set_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("set_id", sa.String(length=120), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column(
            "content_version_at_start",
            sa.String(length=120),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "closed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id",
            "set_id",
            "run_id",
            name="uq_set_runs_user_set_run",
        ),
    )


def downgrade() -> None:
    """Drop set_runs and revert the element_errors unique key to 6 columns."""
    op.drop_table("set_runs")
    with op.batch_alter_table("element_errors", schema=None) as batch_op:
        batch_op.drop_constraint(_UNIQUE, type_="unique")
        batch_op.create_unique_constraint(_UNIQUE, _KEY_COLUMNS)
        batch_op.drop_column("run_id")
