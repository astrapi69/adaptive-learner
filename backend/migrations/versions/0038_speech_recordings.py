"""Add speech_recordings table (engine#68 idea 3: speak-and-record).

Per-user x per-exercise row for the "speak and record" exercise type
(``ext:al-speak-and-record``): a speaker button reads a sentence, a
"show" button reveals its text, a "record" button lets the learner
record themselves saying it. Ungraded - this table is the exercise's
entire persisted state.

Unique constraint on (user_id, source, set_id, lesson_filename,
exercise_id) so a user has exactly one clip per exercise; re-recording
upserts.

Revision ID: 0038_speech_recordings
Revises: 0037_element_errors_run_id_set_runs
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0038_speech_recordings"
down_revision: Union[str, Sequence[str], None] = "0037_element_errors_run_id_set_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "speech_recordings",
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
        sa.Column("lesson_filename", sa.String(length=200), nullable=False),
        sa.Column("exercise_id", sa.String(length=120), nullable=False),
        sa.Column("audio_base64", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column(
            "recorded_at",
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
            "source",
            "set_id",
            "lesson_filename",
            "exercise_id",
            name="uq_speech_recordings_user_exercise",
        ),
    )


def downgrade() -> None:
    op.drop_table("speech_recordings")
