"""CHEATSHEET.md generator.

Two sections:
  - **Notes**: every ``SessionNote`` row with the default
    ``kind="note"``, deduplicated by content (case-insensitive
    exact match).
  - **Meta-Learning Insights**: every ``SessionNote`` row with
    ``kind="meta_learning"`` — the Article-3 slot for
    observations about *how* the learner learns.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..context import RenderContext
from ..labels import Labels

# Constants mirror app.models.SESSION_NOTE_KIND_* — the
# canonical SESSION_NOTE_KINDS frozenset lives in the backend
# model module. Hard-coding the literals here keeps the plugin
# loadable in environments where ``app.*`` isn't on the path
# (plugin smoke tests). If these strings ever change in
# app.models, the backend-side test_session_note_kind_*
# regression pins + a future commit-4 integration test catch
# the drift.
SESSION_NOTE_KIND_NOTE = "note"
SESSION_NOTE_KIND_META_LEARNING = "meta_learning"

if TYPE_CHECKING:
    from app.models import SessionNote


def render_cheatsheet(ctx: RenderContext, labels: Labels) -> str:
    """Render CHEATSHEET.md."""

    lines: list[str] = [
        f"# {labels.cheatsheet_title}",
        "",
        labels.cheatsheet_intro,
        "",
    ]
    lines.extend(_notes_section(ctx, labels))
    lines.extend(_meta_learning_section(ctx, labels))
    return "\n".join(lines).rstrip() + "\n"


def _notes_section(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.cheatsheet_notes_heading}", ""]
    notes = ctx.notes_by_kind(SESSION_NOTE_KIND_NOTE)
    if not notes:
        lines.extend([labels.cheatsheet_no_notes, ""])
        return lines
    for content in _dedupe_by_content(notes):
        lines.append(f"- {_inline(content)}")
    lines.append("")
    return lines


def _meta_learning_section(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.cheatsheet_meta_learning_heading}", ""]
    notes = ctx.notes_by_kind(SESSION_NOTE_KIND_META_LEARNING)
    if not notes:
        lines.extend([labels.cheatsheet_no_meta_learning, ""])
        return lines
    for content in _dedupe_by_content(notes):
        lines.append(f"- {_inline(content)}")
    lines.append("")
    return lines


def _dedupe_by_content(notes: list[SessionNote]) -> list[str]:
    """Sort by created_at and drop repeats (case-insensitive)."""

    seen: set[str] = set()
    ordered: list[str] = []
    for note in sorted(notes, key=lambda n: n.created_at):
        key = note.content.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(note.content.strip())
    return ordered


def _inline(content: str) -> str:
    """Flatten a multi-line note to a single Markdown bullet line."""

    return " ".join(content.split())
