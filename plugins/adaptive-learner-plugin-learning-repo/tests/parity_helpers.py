"""Adapter: parity-test fixture JSON -> RenderContext.

Phase 49F / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01.

The shared fixture at ``tests/fixtures/learning-repo-parity/
input.json`` is consumed by both the Python parity test (via
this module) and the TS parity test (via Node's fs). Both
sides build a RenderContext from the same dict shape and
must produce byte-identical Markdown — that's the parity
contract.

Uses SimpleNamespace-wrapped data so we don't need
SQLAlchemy model instances to exercise the renderer. The
renderer only attribute-accesses its inputs; SimpleNamespace
gives that for free.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from adaptive_learner_learning_repo.context import RenderContext, derive_topics


def _parse_iso(s: str | None) -> datetime | None:
    """Parse an ISO 8601 string into a tz-aware datetime.

    Handles both the ``Z`` suffix and explicit ``+00:00``
    offsets so the same fixture works whether it was authored
    by Python (``isoformat()``) or TS (``Date.toISOString()``).
    """

    if s is None:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def _ns_with_isos(d: dict[str, Any], iso_fields: tuple[str, ...]) -> SimpleNamespace:
    """Build a SimpleNamespace from a dict, parsing the named
    ISO-date fields into datetime objects in place."""

    ns = SimpleNamespace(**d)
    for field in iso_fields:
        raw = d.get(field)
        if isinstance(raw, str) or raw is None:
            setattr(ns, field, _parse_iso(raw))
    return ns


def load_parity_context(fixture_path: Path) -> RenderContext:
    """Build a RenderContext from the shared parity fixture
    JSON. Caller is the parity test."""

    data = json.loads(fixture_path.read_text(encoding="utf-8"))

    project = _ns_with_isos(data["project"], ("created_at", "updated_at"))
    sessions = tuple(
        _ns_with_isos(s, ("started_at", "ended_at")) for s in data["sessions"]
    )
    ratings = tuple(
        _ns_with_isos(r, ("created_at",)) for r in data["ratings"]
    )
    step_evaluations = tuple(
        _ns_with_isos(e, ("evaluated_at",)) for e in data["step_evaluations"]
    )
    method_switches = tuple(
        _ns_with_isos(m, ("switched_at",)) for m in data["method_switches"]
    )
    notes = tuple(
        _ns_with_isos(n, ("created_at",)) for n in data["notes"]
    )

    rendered_at = _parse_iso(data.get("rendered_at")) or datetime.now()

    return RenderContext(
        project=project,
        sessions=sessions,
        ratings=ratings,
        step_evaluations=step_evaluations,
        method_switches=method_switches,
        notes=notes,
        topics=derive_topics(sessions),
        rendered_at=rendered_at,
    )
