"""Add element_errors table (Phase 46B / v1.30.0 / P-129).

Element-level error + mastery tracking for the spaced-
repetition layer. One row per ``(user_id, set_id, lesson_id,
exercise_id, element_key)`` quintuple. Decoupled from
``learning_sessions`` — content-loader lessons are
identified by string ids and the table survives cache
evictions independent of the Phase 44 ``lesson_progress``
flow.

Unique constraint enforces the per-element upsert contract:
the service layer in commit C5 INSERTs on first sighting and
UPDATEs the same row for every subsequent attempt
(incrementing ``error_count`` on wrong, ``correct_streak`` on
correct, flipping ``mastered`` at the threshold).

Decoupled from the Phase 46F session unification (which
lands in v1.31.0 / 46E-F) by design: this table references
content lessons by string id, never by a
``learning_sessions.id`` FK, so the v1.30.0 element-tracking
foundation ships independent of the unification work.

Revision ID: 0019_element_errors
Revises: 0018_lesson_progress
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_element_errors"
down_revision: Union[str, Sequence[str], None] = "0018_lesson_progress"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "element_errors",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("set_id", sa.String(length=120), nullable=False),
        sa.Column("lesson_id", sa.String(length=200), nullable=False),
        sa.Column("exercise_id", sa.String(length=120), nullable=False),
        sa.Column("element_key", sa.String(length=500), nullable=False),
        sa.Column(
            "element_type",
            sa.String(length=50),
            nullable=False,
            server_default="vocabulary",
        ),
        sa.Column(
            "user_answer", sa.Text(), nullable=False, server_default="",
        ),
        sa.Column(
            "correct_answer",
            sa.Text(),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "error_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "correct_streak",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "last_error_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_attempt_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "mastered",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "mastered_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id",
            "set_id",
            "lesson_id",
            "exercise_id",
            "element_key",
            name="uq_element_errors_user_element",
        ),
    )


def downgrade() -> None:
    op.drop_table("element_errors")
