"""Add the Perplexity provider columns to user_settings (#2512).

Perplexity joins as the fourth AI provider (OpenAI-compatible wire
format, backend-only because the provider blocks browser CORS
calls). Mirrors the per-provider column pattern: one Fernet
ciphertext key column plus one plain-text model override.

Revision ID: 0036_user_settings_perplexity
Revises: 0035_element_errors_retired_at
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# Alembic identifiers.
revision: str = "0036_user_settings_perplexity"
down_revision: Union[str, Sequence[str], None] = "0035_element_errors_retired_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("api_key_perplexity", sa.Text(), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("model_override_perplexity", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "model_override_perplexity")
    op.drop_column("user_settings", "api_key_perplexity")
