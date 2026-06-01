"""Add api_key_backups (Phase 65 — API-key rollback cache).

The revised key-save flow auto-tests a new key and, on success, caches
the last-known-good ciphertext per (user, provider) so a later
overwrite with a non-working key can be rolled back in one click. A
local safety net only — NOT part of the cross-device sync surface.

Revision ID: 0025_api_key_backups
Revises: 0024_lesson_progress_pause_abandon
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_api_key_backups"
down_revision: Union[str, Sequence[str], None] = "0024_lesson_progress_pause_abandon"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_key_backups",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("tested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "works",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "provider",
            name="uq_api_key_backups_user_provider",
        ),
    )


def downgrade() -> None:
    op.drop_table("api_key_backups")
