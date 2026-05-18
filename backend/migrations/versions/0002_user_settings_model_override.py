"""Add per-provider model_override columns to user_settings.

v0.4.0 lets users override the session plugin's
ai_orchestration.DEFAULT_MODELS pick for any of the three
shipped providers. Three nullable String(200) columns — NULL
means 'use the default'; non-NULL replaces the default for that
provider only.

Revision ID: 0002_user_settings_model_override
Revises: 0001_initial_domain
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# Alembic identifiers.
revision: str = "0002_user_settings_model_override"
down_revision: Union[str, Sequence[str], None] = "0001_initial_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("model_override_anthropic", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("model_override_openai", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("model_override_gemini", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "model_override_gemini")
    op.drop_column("user_settings", "model_override_openai")
    op.drop_column("user_settings", "model_override_anthropic")
