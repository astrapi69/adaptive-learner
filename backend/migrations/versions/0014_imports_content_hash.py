"""Add content_hash to imported_conversations (Phase 36 Bug 1 / v1.21.1).

Duplicate-import detection: the manual Phase 36 test surfaced that
pasting the same Claude/ChatGPT transcript twice yields two rows
because the only uniqueness key was the auto-generated UUID. The
fix is a SHA-256 of the role-prefixed, content-stripped transcript
joined by ``\\n`` — title-independent so re-importing with a fresh
display title still detects as a duplicate.

The column is nullable to keep historic rows valid; the back-fill
loop in this migration recomputes the hash for every existing row.
An index on (user_id, content_hash) is added so the per-user
duplicate check on import is O(log n).

Revision ID: 0014_imports_content_hash
Revises: 0013_study_questions
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_imports_content_hash"
down_revision: Union[str, Sequence[str], None] = "0013_study_questions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _compute_hash(messages: Sequence[tuple[str, str]]) -> str:
    """Same algorithm as ``app.services.imports.compute_content_hash``.

    Duplicated here so the migration runs without importing app
    code (alembic env.py imports models for autogenerate but the
    helper would create an import-time dependency we don't want).
    Keep these two in lockstep.
    """
    payload = "\n".join(f"{role.lower()}:{content.strip()}" for role, content in messages)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def upgrade() -> None:
    with op.batch_alter_table("imported_conversations", schema=None) as batch_op:
        batch_op.add_column(sa.Column("content_hash", sa.String(length=64), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_imported_conversations_content_hash"),
            ["content_hash"],
            unique=False,
        )

    bind = op.get_bind()
    convs = bind.execute(sa.text("SELECT id FROM imported_conversations")).fetchall()
    for (conv_id,) in convs:
        rows = bind.execute(
            sa.text(
                "SELECT role, content FROM imported_messages "
                "WHERE conversation_id = :cid ORDER BY order_index"
            ),
            {"cid": conv_id},
        ).fetchall()
        digest = _compute_hash([(r[0], r[1]) for r in rows])
        bind.execute(
            sa.text(
                "UPDATE imported_conversations SET content_hash = :h WHERE id = :id"
            ),
            {"h": digest, "id": conv_id},
        )


def downgrade() -> None:
    with op.batch_alter_table("imported_conversations", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_imported_conversations_content_hash"))
        batch_op.drop_column("content_hash")
