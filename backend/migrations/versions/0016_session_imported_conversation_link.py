"""Add learning_sessions.imported_conversation_id (Phase 36 Bug 4 / v1.21.1).

Children-side FK from a session back to the imported conversation
it was started from. Lets ImportDetail's "Start session" button
resume an existing active session instead of always creating a
new one.

Nullable: free-form sessions keep ``NULL``. ``SET NULL`` on
delete so removing the source conversation does not wipe the
derived session history.

Revision ID: 0016_session_imported_conversation_link
Revises: 0015_curriculum_imported_conversation_link
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_session_imported_conversation_link"
down_revision: Union[str, Sequence[str], None] = (
    "0015_curriculum_imported_conversation_link"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("learning_sessions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("imported_conversation_id", sa.String(length=36), nullable=True)
        )
        batch_op.create_index(
            batch_op.f("ix_learning_sessions_imported_conversation_id"),
            ["imported_conversation_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_learning_sessions_imported_conversation_id_imported_conversations",
            "imported_conversations",
            ["imported_conversation_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("learning_sessions", schema=None) as batch_op:
        batch_op.drop_constraint(
            "fk_learning_sessions_imported_conversation_id_imported_conversations",
            type_="foreignkey",
        )
        batch_op.drop_index(
            batch_op.f("ix_learning_sessions_imported_conversation_id")
        )
        batch_op.drop_column("imported_conversation_id")
