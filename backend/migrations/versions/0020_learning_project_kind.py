"""Add learning_projects.kind (Phase 46F / v1.31.0 / D1).

Splits the wizard-created ``standard`` projects from the auto-
managed ``content`` pseudo-project that backs the
LessonProgress<->LearningSession unification: when a content
lesson completes, the lesson service finds-or-creates a
``kind="content"`` project for the user, writes a
``LearningSession`` row against it, and the gamification
plugin's existing ``on_session_complete`` handler picks up the
XP / badge / streak update without any new hook code.

``String(32)``, ``nullable=False``, ``server_default="standard"`` —
matches the ``session_notes.kind`` shape from 0017. Existing
rows back-fill to ``"standard"`` via the server_default; the
pseudo-project rows that 46F.2's ``mark_completed`` creates
will carry ``"content"``.

Frontend project pickers (Dashboard, Onboarding,
LearningRepoSettings) filter out ``kind="content"`` so the
pseudo-project never appears as a legit learning goal — see
``LEARNING_PROJECT_KINDS`` in ``app/models/__init__.py`` for
the canonical constant set.

Revision ID: 0020_learning_project_kind
Revises: 0019_element_errors
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020_learning_project_kind"
down_revision: Union[str, Sequence[str], None] = "0019_element_errors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("learning_projects", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "kind",
                sa.String(length=32),
                nullable=False,
                server_default="standard",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("learning_projects", schema=None) as batch_op:
        batch_op.drop_column("kind")
