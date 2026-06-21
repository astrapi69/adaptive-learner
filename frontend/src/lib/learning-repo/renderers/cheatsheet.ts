/**
 * CHEATSHEET.md generator (Phase 49D / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``cheatsheet.py`` at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * meta/cheatsheet.py``. Parity test (49F) pins byte-for-byte.
 *
 * Two sections:
 *   - **Notes**: every ``SessionNote`` row with
 *     ``kind="note"``, deduplicated by content (case-insensitive
 *     exact match).
 *   - **Meta-Learning Insights**: every ``SessionNote`` row
 *     with ``kind="meta_learning"`` — the Article-3 slot for
 *     observations about *how* the learner learns.
 */

import type {Labels} from "../labels";
import {notesByKind, type RenderContext, type SessionNoteData} from "../render-context";

// Mirror Python's hard-coded literals. The canonical
// ``SESSION_NOTE_KINDS`` frozenset lives in the backend
// model module; these strings are pinned here for parity.
const SESSION_NOTE_KIND_NOTE = "note";
const SESSION_NOTE_KIND_META_LEARNING = "meta_learning";

/**
 * Render the CHEATSHEET.md body for one project: a deduplicated
 * Notes section (``kind="note"``) followed by a Meta-Learning
 * Insights section (``kind="meta_learning"``).
 */
export function renderCheatsheet(
    ctx: RenderContext,
    labels: Labels,
): string {
    const lines: string[] = [
        `# ${labels.cheatsheet_title}`,
        "",
        labels.cheatsheet_intro,
        "",
    ];
    lines.push(...notesSection(ctx, labels));
    lines.push(...metaLearningSection(ctx, labels));
    return rstripWithNewline(lines.join("\n"));
}

function notesSection(ctx: RenderContext, labels: Labels): string[] {
    const lines: string[] = [
        `## ${labels.cheatsheet_notes_heading}`,
        "",
    ];
    const notes = notesByKind(ctx, SESSION_NOTE_KIND_NOTE);
    if (notes.length === 0) {
        lines.push(labels.cheatsheet_no_notes, "");
        return lines;
    }
    for (const content of dedupeByContent(notes)) {
        lines.push(`- ${inline(content)}`);
    }
    lines.push("");
    return lines;
}

function metaLearningSection(
    ctx: RenderContext,
    labels: Labels,
): string[] {
    const lines: string[] = [
        `## ${labels.cheatsheet_meta_learning_heading}`,
        "",
    ];
    const notes = notesByKind(ctx, SESSION_NOTE_KIND_META_LEARNING);
    if (notes.length === 0) {
        lines.push(labels.cheatsheet_no_meta_learning, "");
        return lines;
    }
    for (const content of dedupeByContent(notes)) {
        lines.push(`- ${inline(content)}`);
    }
    lines.push("");
    return lines;
}

/**
 * Sort by created_at ascending and drop repeats by case-
 * insensitive trimmed content. Mirrors Python's
 * ``_dedupe_by_content``.
 */
function dedupeByContent(notes: readonly SessionNoteData[]): string[] {
    const sorted = [...notes].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
    );
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const note of sorted) {
        const key = note.content.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push(note.content.trim());
    }
    return ordered;
}

/**
 * Flatten a multi-line note to a single Markdown bullet line.
 * Mirrors Python's ``" ".join(content.split())`` — split on
 * any whitespace and rejoin with single spaces.
 */
function inline(content: string): string {
    return content.split(/\s+/).filter((s) => s.length > 0).join(" ");
}

function rstripWithNewline(s: string): string {
    return s.replace(/[\s\n]+$/, "") + "\n";
}
