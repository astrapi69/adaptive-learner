"""Add avatar to user_settings (#508 — user profile picture).

A learner can set a profile picture, stored as a small base64 data URL
(a client-resized, <= 100 KB square JPEG/PNG). It lives on
``user_settings`` so it rides the existing sync + backup surface. NULL
means "use the generated initials avatar", so existing rows need no
backfill.

Revision ID: 0029_user_settings_avatar
Revises: 0028_subjects_unique_parent_name
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_user_settings_avatar"
down_revision: Union[str, Sequence[str], None] = "0028_subjects_unique_parent_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the nullable avatar column."""
    with op.batch_alter_table("user_settings") as batch:
        batch.add_column(sa.Column("avatar", sa.Text(), nullable=True))


def downgrade() -> None:
    """Drop avatar."""
    with op.batch_alter_table("user_settings") as batch:
        batch.drop_column("avatar")
