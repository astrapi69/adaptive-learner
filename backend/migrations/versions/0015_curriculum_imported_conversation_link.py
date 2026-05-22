"""Add curriculums.imported_conversation_id (Phase 36 Bug 3 / v1.21.1).

Children-side FK from a generated curriculum back to the imported
conversation it was derived from. Lets ImportDetail flip the
"Create curriculum" CTA into a "Go to curriculum" navigation when
a curriculum already exists for this conversation, so the user
can no longer accidentally generate duplicates.

Nullable: free-form curricula keep ``NULL``. ``SET NULL`` on
delete so removing the source conversation does not wipe the
derived curriculum.

Revision ID: 0015_curriculum_imported_conversation_link
Revises: 0014_imports_content_hash
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_curriculum_imported_conversation_link"
down_revision: Union[str, Sequence[str], None] = "0014_imports_content_hash"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("curriculums", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("imported_conversation_id", sa.String(length=36), nullable=True)
        )
        batch_op.create_index(
            batch_op.f("ix_curriculums_imported_conversation_id"),
            ["imported_conversation_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_curriculums_imported_conversation_id_imported_conversations",
            "imported_conversations",
            ["imported_conversation_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("curriculums", schema=None) as batch_op:
        batch_op.drop_constraint(
            "fk_curriculums_imported_conversation_id_imported_conversations",
            type_="foreignkey",
        )
        batch_op.drop_index(batch_op.f("ix_curriculums_imported_conversation_id"))
        batch_op.drop_column("imported_conversation_id")
