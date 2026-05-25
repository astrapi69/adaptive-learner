"""Add session_notes.kind (Phase 42 / v1.26.0 / BL-30 prerequisite).

Adds a free-text ``kind`` column to ``session_notes`` so the
learning-repo plugin renderer can slice "Meta-Learning Insight"
entries (per the *Von Theorie zur Praxis* Article 3 pattern)
out of the broader note stream into a separate CHEATSHEET
section.

``String(32)``, ``nullable=False``, ``server_default="note"`` —
matches the ``MethodSwitch.from_method`` / ``.to_method`` shape
(no DB-level enum constraint). Canonical kinds live in
``app.models.SESSION_NOTE_KINDS``. Existing rows back-fill to
``"note"`` via the server_default.

Revision ID: 0017_session_note_kind
Revises: 0016_session_imported_conversation_link
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_session_note_kind"
down_revision: Union[str, Sequence[str], None] = (
    "0016_session_imported_conversation_link"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("session_notes", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "kind",
                sa.String(length=32),
                nullable=False,
                server_default="note",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("session_notes", schema=None) as batch_op:
        batch_op.drop_column("kind")
