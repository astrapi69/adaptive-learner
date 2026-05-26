"""Add lesson_progress table (Phase 44 / v1.28.0 / P-109).

Per-user × per-content-loader-lesson progress tracking. Parallel
to the existing ``learning_sessions`` table; the two systems
coexist in v1.28.0 (a lesson does NOT advance a session and vice
versa). Phase 46 (Lesson Summary + SRS) unifies them when XP /
streak / progress-commit integration lands.

Unique constraint on ``(user_id, source, set_id, lesson_filename)``
so a user has exactly one progress row per lesson — the viewer
upserts on every step completion.

Revision ID: 0018_lesson_progress
Revises: 0017_session_note_kind
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_lesson_progress"
down_revision: Union[str, Sequence[str], None] = "0017_session_note_kind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_progress",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("source", sa.String(length=200), nullable=False),
        sa.Column("set_id", sa.String(length=120), nullable=False),
        sa.Column(
            "lesson_filename", sa.String(length=200), nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="in_progress",
        ),
        sa.Column(
            "step_results", sa.Text(), nullable=False, server_default="{}",
        ),
        sa.Column(
            "score_correct",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "score_total",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "time_spent_seconds",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "user_id",
            "source",
            "set_id",
            "lesson_filename",
            name="uq_lesson_progress_user_lesson",
        ),
    )


def downgrade() -> None:
    op.drop_table("lesson_progress")
