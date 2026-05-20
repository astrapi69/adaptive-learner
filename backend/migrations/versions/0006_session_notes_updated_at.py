"""Add updated_at column to session_notes for mutable sync.

Phase 21B — v1.8.0. Session notes were created as append-only
(``id, session_id, content, created_at``) but are functionally
mutable in the UI (users edit their notes). To carry edits across
devices, the sync surface needs an ``updated_at`` timestamp so the
push/pull conflict-resolution layer can compare versions.

For existing rows the new column is back-filled to equal
``created_at`` — a freshly-created note has ``updated_at ==
created_at`` and that's the right default for historical rows
too. After the migration runs, every mutation point in the
session-notes service updates the column via SQLAlchemy's
``onupdate=_utcnow``.

Revision ID: 0006_session_notes_updated_at
Revises: 0005_session_cycle_count
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_session_notes_updated_at"
down_revision: Union[str, Sequence[str], None] = "0005_session_cycle_count"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("session_notes") as batch:
        # Add nullable first; SQLite can't add NOT NULL without a
        # column default on existing rows, and we want a row-by-
        # row backfill from ``created_at`` instead of a static
        # default. The ``ALTER COLUMN ... NOT NULL`` step happens
        # after the backfill below.
        batch.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )
    # Backfill: every existing row gets ``updated_at = created_at``.
    op.execute("UPDATE session_notes SET updated_at = created_at")
    with op.batch_alter_table("session_notes") as batch:
        batch.alter_column("updated_at", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("session_notes") as batch:
        batch.drop_column("updated_at")
