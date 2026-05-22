"""Add study_questions table (Phase 32B / v1.19.0).

AI-generated active-recall questions per project. Users review,
edit, accept, or delete each row; accepted questions feed the
NotebookLM ZIP export and the Progress page's Study Questions
section.

Revision ID: 0013_study_questions
Revises: 0012_anki_card_suggestions
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_study_questions"
down_revision: Union[str, Sequence[str], None] = "0012_anki_card_suggestions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "study_questions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column(
            "expected_answer", sa.Text(), nullable=False, server_default=""
        ),
        sa.Column(
            "question_type",
            sa.String(length=20),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "difficulty",
            sa.String(length=10),
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "topic", sa.String(length=200), nullable=False, server_default=""
        ),
        sa.Column(
            "edited", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["learning_projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["learning_sessions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("study_questions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_study_questions_user_id"), ["user_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_study_questions_project_id"),
            ["project_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_study_questions_session_id"),
            ["session_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("study_questions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_study_questions_session_id"))
        batch_op.drop_index(batch_op.f("ix_study_questions_project_id"))
        batch_op.drop_index(batch_op.f("ix_study_questions_user_id"))
    op.drop_table("study_questions")
