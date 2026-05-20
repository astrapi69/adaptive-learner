"""Create imported_conversations + imported_messages tables.

Phase 12C — v0.9.0 chat-history import surface. ``imported_messages``
references ``imported_conversations`` with cascade delete so
conversation cleanup wipes the transcript in one shot.
``imported_conversations.project_id`` is a soft FK to
``learning_projects`` with ``ondelete=SET NULL`` so deleting a
project does not destroy the user's import history.

Revision ID: 0004_imported_conversations
Revises: 0003_step_evaluations
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# Alembic identifiers.
revision: str = "0004_imported_conversations"
down_revision: Union[str, Sequence[str], None] = "0003_step_evaluations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "imported_conversations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("learning_projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column(
            "message_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "analyzed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("analysis_result", sa.Text(), nullable=True),
        sa.Column("topic_tag", sa.String(length=200), nullable=True),
        sa.Column("model", sa.String(length=200), nullable=True),
        sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_imported_conversations_user_id",
        "imported_conversations",
        ["user_id"],
    )
    op.create_index(
        "ix_imported_conversations_project_id",
        "imported_conversations",
        ["project_id"],
    )

    op.create_table(
        "imported_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.String(length=36),
            sa.ForeignKey("imported_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "order_index",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_index(
        "ix_imported_messages_conversation_id",
        "imported_messages",
        ["conversation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_imported_messages_conversation_id",
        table_name="imported_messages",
    )
    op.drop_table("imported_messages")
    op.drop_index(
        "ix_imported_conversations_project_id",
        table_name="imported_conversations",
    )
    op.drop_index(
        "ix_imported_conversations_user_id",
        table_name="imported_conversations",
    )
    op.drop_table("imported_conversations")
