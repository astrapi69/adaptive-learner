"""Subject taxonomy seed loader (Phase 22B).

Reads ``backend/config/seed/subjects.yaml`` and inserts every node
that doesn't yet exist (identified by ``slug``). Pre-seeds the
global Subject tree on first run; subsequent runs are no-ops
because the loader compares by slug.

Why slug instead of name: nodes at different tree positions can
share a name (e.g. "Grammar" appears under every language). The
slug is the stable identity that survives renames + ensures
idempotent seeding.

The ``slug`` is NOT a column on the Subject model — it lives as
the YAML identity only. We persist the resolved name + parent_id
and key our "already-seeded?" check on a sidecar mapping
(slug -> Subject.id) that we rebuild on every seed run by
matching ``Subject.name + Subject.parent_id`` back to slugs.

Locale handling: the seed YAML carries ``name`` (EN canonical) and
optional ``name_de`` (German). The loader writes ONE Subject row
per slug with ``name`` = the EN canonical text. Frontend i18n is
a future hook; today the EN name is the display name everywhere.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.orm import Session

from app.models import Subject

logger = logging.getLogger(__name__)


SEED_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "seed" / "subjects.yaml"


def _load_yaml(path: Path) -> list[Mapping[str, Any]]:
    if not path.exists():
        logger.warning("Subject seed YAML missing at %s; skipping seed.", path)
        return []
    with path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    nodes = raw.get("subjects")
    if not isinstance(nodes, list):
        logger.warning(
            "Subject seed YAML at %s has no ``subjects`` list; skipping.",
            path,
        )
        return []
    valid: list[Mapping[str, Any]] = []
    for entry in nodes:
        if not isinstance(entry, Mapping):
            continue
        if not isinstance(entry.get("slug"), str) or not isinstance(
            entry.get("name"), str
        ):
            logger.warning("Skipping malformed subject entry: %r", entry)
            continue
        valid.append(entry)
    return valid


def _existing_by_slug(db: Session, entries: Iterable[Mapping[str, Any]]) -> dict[str, str]:
    """Build slug -> Subject.id for entries already in the DB.

    The match is structural: a node's slug resolves to the same row
    as a node with the same (name, parent_slug-resolved-id). The
    seed loader is the only writer that knows the slug schema, so
    a slug match is unambiguous as long as the seed YAML is the
    only source of pre-existing rows.
    """
    # Two-pass: first index every Subject by (parent_id, name) for
    # O(1) lookup. Then for each seed entry, resolve its parent's
    # already-known id (if any) and look up the pair.
    by_parent_name: dict[tuple[str | None, str], str] = {}
    for row in db.query(Subject).all():
        by_parent_name[(row.parent_id, row.name)] = row.id

    resolved: dict[str, str] = {}
    # Iterate seed entries multiple times so parents resolve before
    # children. The YAML order already places parents first, so
    # one pass is enough in practice; we keep a second pass for
    # paranoia (parent declared after child).
    for _attempt in range(2):
        for entry in entries:
            slug = entry["slug"]
            if slug in resolved:
                continue
            parent_slug = entry.get("parent")
            parent_id: str | None = None
            if isinstance(parent_slug, str):
                parent_id = resolved.get(parent_slug)
                if parent_id is None:
                    # parent not seen yet; defer to next pass
                    continue
            key = (parent_id, entry["name"])
            row_id = by_parent_name.get(key)
            if row_id is not None:
                resolved[slug] = row_id
    return resolved


def seed_subjects(db: Session) -> dict[str, int]:
    """Insert every missing seed Subject. Idempotent.

    Returns a small summary the caller can log: how many entries
    the YAML carried, how many were already present, how many
    were inserted.
    """
    entries = _load_yaml(SEED_PATH)
    if not entries:
        return {"available": 0, "existing": 0, "inserted": 0}
    existing = _existing_by_slug(db, entries)
    inserted = 0
    # Insert in YAML order so parents always commit before children
    # within a single seed run. Flush after every insert so the
    # subsequent parent-id lookup sees the row.
    slug_to_id: dict[str, str] = dict(existing)
    for entry in entries:
        slug = entry["slug"]
        if slug in slug_to_id:
            continue
        parent_slug = entry.get("parent")
        parent_id: str | None = None
        if isinstance(parent_slug, str):
            parent_id = slug_to_id.get(parent_slug)
            if parent_id is None:
                logger.warning(
                    "Subject seed %r references unknown parent %r; skipping.",
                    slug,
                    parent_slug,
                )
                continue
        row = Subject(
            name=entry["name"],
            description=entry.get("description"),
            icon=entry.get("icon"),
            parent_id=parent_id,
        )
        db.add(row)
        db.flush()
        slug_to_id[slug] = row.id
        inserted += 1
    db.commit()
    return {
        "available": len(entries),
        "existing": len(existing),
        "inserted": inserted,
    }


__all__ = ["SEED_PATH", "seed_subjects"]
