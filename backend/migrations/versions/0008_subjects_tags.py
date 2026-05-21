"""Add subjects, tags, project_subjects, project_tags (Phase 22A).

Four new domain tables for global subjects + per-user tags + the
many-to-many associations to :class:`LearningProject`:

- ``subjects`` — global, hierarchical (self-FK ``parent_id``).
- ``tags`` — per-user, unique per (user_id, name).
- ``project_subjects`` — M:N project <-> subject (unique pair).
- ``project_tags`` — M:N project <-> tag (unique pair).

Revision ID: 0008_subjects_tags
Revises: 0007_imported_messages_created_at
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_subjects_tags"
down_revision: Union[str, Sequence[str], None] = "0007_imported_messages_created_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subjects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("parent_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("subjects", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_subjects_parent_id"), ["parent_id"], unique=False
        )

    op.create_table(
        "tags",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )
    with op.batch_alter_table("tags", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_tags_user_id"), ["user_id"], unique=False)

    op.create_table(
        "project_subjects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("subject_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["learning_projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id", "subject_id", name="uq_project_subjects_pair"
        ),
    )
    with op.batch_alter_table("project_subjects", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_project_subjects_project_id"),
            ["project_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_project_subjects_subject_id"),
            ["subject_id"],
            unique=False,
        )

    op.create_table(
        "project_tags",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("tag_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["learning_projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "tag_id", name="uq_project_tags_pair"),
    )
    with op.batch_alter_table("project_tags", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_project_tags_project_id"),
            ["project_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_project_tags_tag_id"),
            ["tag_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("project_tags", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_tags_tag_id"))
        batch_op.drop_index(batch_op.f("ix_project_tags_project_id"))
    op.drop_table("project_tags")

    with op.batch_alter_table("project_subjects", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_subjects_subject_id"))
        batch_op.drop_index(batch_op.f("ix_project_subjects_project_id"))
    op.drop_table("project_subjects")

    with op.batch_alter_table("tags", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tags_user_id"))
    op.drop_table("tags")

    with op.batch_alter_table("subjects", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_subjects_parent_id"))
    op.drop_table("subjects")
