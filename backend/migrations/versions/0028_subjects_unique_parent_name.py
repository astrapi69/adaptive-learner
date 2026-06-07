"""Add UNIQUE(parent_id, name) to subjects + dedup existing rows.

Issue #127: a backup restore onto a fresh install duplicated the whole
``subjects`` taxonomy because subjects had no natural key, so the
restore matcher could only reconcile by id (which differs per install,
since the seed assigns random ids). ``badges`` already reconcile via
``badges.key`` (#49); subjects now get the same treatment on their
canonical identity ``(parent_id, name)`` — the exact key the seeder
itself reconciles on.

This migration:
  1. Dedups any pre-existing ``(parent_id, name)`` duplicates (a user
     who already ran a restore could hold them): keep the oldest row,
     re-point children + project assignments to it, delete the rest.
  2. Adds the UNIQUE(parent_id, name) constraint.

Revision ID: 0028_subjects_unique_parent_name
Revises: 0027_lesson_progress_current_step
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_subjects_unique_parent_name"
down_revision: Union[str, Sequence[str], None] = "0027_lesson_progress_current_step"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _dedup_subjects(conn: sa.Connection) -> None:
    """Collapse duplicate ``(parent_id, name)`` subjects onto one row.

    Keeps the row with the smallest ``created_at`` (ties broken by id),
    re-points every child ``parent_id`` and ``project_subjects.subject_id``
    to the keeper, then deletes the duplicates. NULL parents are grouped
    with a sentinel so root-level duplicates collapse too (SQLite treats
    NULLs as distinct in a UNIQUE index, so they must be removed here).
    """
    rows = conn.execute(
        sa.text("SELECT id, parent_id, name, created_at FROM subjects")
    ).fetchall()
    groups: dict[tuple[str, str], list[sa.Row]] = defaultdict(list)
    for row in rows:
        groups[(row.parent_id or "\x00ROOT", row.name)].append(row)

    for members in groups.values():
        if len(members) < 2:
            continue
        ordered = sorted(members, key=lambda r: (str(r.created_at or ""), r.id))
        keeper = ordered[0]
        for dup in ordered[1:]:
            conn.execute(
                sa.text("UPDATE subjects SET parent_id = :keep WHERE parent_id = :dup"),
                {"keep": keeper.id, "dup": dup.id},
            )
            # Re-point project assignments; drop ones that would collide
            # with the keeper on the UNIQUE(project_id, subject_id) pair.
            assignments = conn.execute(
                sa.text("SELECT id, project_id FROM project_subjects WHERE subject_id = :dup"),
                {"dup": dup.id},
            ).fetchall()
            for assignment in assignments:
                exists = conn.execute(
                    sa.text(
                        "SELECT 1 FROM project_subjects "
                        "WHERE project_id = :pid AND subject_id = :keep"
                    ),
                    {"pid": assignment.project_id, "keep": keeper.id},
                ).first()
                if exists is not None:
                    conn.execute(
                        sa.text("DELETE FROM project_subjects WHERE id = :aid"),
                        {"aid": assignment.id},
                    )
                else:
                    conn.execute(
                        sa.text(
                            "UPDATE project_subjects SET subject_id = :keep WHERE id = :aid"
                        ),
                        {"keep": keeper.id, "aid": assignment.id},
                    )
            conn.execute(
                sa.text("DELETE FROM subjects WHERE id = :dup"), {"dup": dup.id}
            )


def upgrade() -> None:
    _dedup_subjects(op.get_bind())
    with op.batch_alter_table("subjects", schema=None) as batch_op:
        batch_op.create_unique_constraint("uq_subjects_parent_name", ["parent_id", "name"])


def downgrade() -> None:
    with op.batch_alter_table("subjects", schema=None) as batch_op:
        batch_op.drop_constraint("uq_subjects_parent_name", type_="unique")
