"""Add created_at to imported_messages for sync surface inclusion.

Phase 21D — v1.8.0. ImportedMessage rows are bulk-created when a
conversation is imported, so they all share the parent
conversation's ``imported_at`` timestamp. To put them on the sync
surface, the table needs a per-row timestamp the sync filter can
compare against ``last_sync_at``.

The new ``created_at`` column is back-filled from the parent
``imported_conversations.imported_at`` for existing rows — every
historical message shares the conversation's import moment, which
is the correct creation time. New rows get ``_utcnow`` via the
SQLAlchemy column default.

Revision ID: 0007_imported_messages_created_at
Revises: 0006_session_notes_updated_at
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_imported_messages_created_at"
down_revision: Union[str, Sequence[str], None] = "0006_session_notes_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("imported_messages") as batch:
        batch.add_column(
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )
    # Back-fill: each message inherits its conversation's
    # imported_at. SQLite supports correlated subqueries in
    # UPDATE since 3.33; the FastAPI test env runs 3.40+, so
    # this is portable.
    op.execute(
        """
        UPDATE imported_messages
        SET created_at = (
            SELECT imported_at
            FROM imported_conversations
            WHERE imported_conversations.id = imported_messages.conversation_id
        )
        """,
    )
    with op.batch_alter_table("imported_messages") as batch:
        batch.alter_column("created_at", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("imported_messages") as batch:
        batch.drop_column("created_at")
