"""Add source_language + target_language to imported_conversations (v1.54.0).

Languages are now captured at IMPORT time (the chat language the learner
speaks = source; the language being learned = target) so they flow
through the whole pipeline (analysis -> save-as-lesson -> share) instead
of being guessed and patched downstream. Both columns are nullable: rows
created before this migration fall back to the app-language default in
the UI.

Revision ID: 0026_imported_conversation_languages
Revises: 0025_api_key_backups
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026_imported_conversation_languages"
down_revision: Union[str, Sequence[str], None] = "0025_api_key_backups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "imported_conversations",
        sa.Column("source_language", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "imported_conversations",
        sa.Column("target_language", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("imported_conversations", "target_language")
    op.drop_column("imported_conversations", "source_language")
