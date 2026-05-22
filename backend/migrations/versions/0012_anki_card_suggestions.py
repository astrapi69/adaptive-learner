"""Add anki_card_suggestions table (Phase 30B).

AI-extracted flashcard candidates that the user reviews +
accepts before .apkg export.

Revision ID: 0012_anki_card_suggestions
Revises: 0011_user_streaks
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_anki_card_suggestions"
down_revision: Union[str, Sequence[str], None] = "0011_user_streaks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "anki_card_suggestions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("conversation_id", sa.String(length=36), nullable=True),
        sa.Column("project_id", sa.String(length=36), nullable=True),
        sa.Column(
            "card_type", sa.String(length=20), nullable=False, server_default="basic"
        ),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=False),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column(
            "accepted", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "rejected", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["session_id"], ["learning_sessions.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["imported_conversations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["learning_projects.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("anki_card_suggestions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_anki_card_suggestions_user_id"),
            ["user_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_anki_card_suggestions_session_id"),
            ["session_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_anki_card_suggestions_conversation_id"),
            ["conversation_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_anki_card_suggestions_project_id"),
            ["project_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("anki_card_suggestions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_anki_card_suggestions_project_id"))
        batch_op.drop_index(
            batch_op.f("ix_anki_card_suggestions_conversation_id")
        )
        batch_op.drop_index(batch_op.f("ix_anki_card_suggestions_session_id"))
        batch_op.drop_index(batch_op.f("ix_anki_card_suggestions_user_id"))
    op.drop_table("anki_card_suggestions")
