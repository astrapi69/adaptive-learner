/**
 * Content utilities for the rich-text editor (Phase 27A).
 *
 * The persistence contract is: all rich-text columns
 * (``session_notes.content``, ``session_ratings.notes``,
 * ``curriculums.description``, ``lessons.content``) stay TEXT
 * on the backend. The frontend stores a serialised TipTap
 * JSON document (``JSON.stringify(editor.getJSON())``); legacy
 * rows written before Phase 27 carry plain text. Both shapes
 * must render and round-trip without data loss.
 *
 * ``parseEditorContent`` is the read-side detector: it tries
 * JSON.parse first and falls back to "wrap as paragraph" if
 * the string does not look like a TipTap doc. ``serializeEditorContent``
 * is the write-side: ``null`` for empty docs, otherwise the
 * JSON string.
 */

import type {JSONContent} from "@tiptap/core";

/** Minimal shape we accept as a TipTap document at the top
 *  level. We do not validate the full ProseMirror schema —
 *  TipTap's setContent does that and silently drops nodes
 *  it does not recognise. */
function looksLikeTipTapDoc(value: unknown): value is JSONContent {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        (value as {type: unknown}).type === "doc"
    );
}

/**
 * Convert a raw stored content string into a TipTap JSON doc
 * suitable for ``RichTextEditor``'s ``content`` prop.
 *
 * - ``null`` / ``""`` / whitespace-only -> ``null`` (renders empty)
 * - valid TipTap JSON -> parsed doc
 * - any other string -> wrapped as a single paragraph node
 *   (legacy plain-text rows from before Phase 27)
 */
export function parseEditorContent(stored: string | null | undefined): JSONContent | null {
    if (stored == null) return null;
    const trimmed = stored.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const candidate = JSON.parse(trimmed);
            if (looksLikeTipTapDoc(candidate)) return candidate;
        } catch {
            // Fall through to plain-text wrapping.
        }
    }
    return wrapAsParagraphs(stored);
}

/**
 * Serialise an editor JSON doc back into a stored string.
 *
 * - ``null`` -> ``null`` (empty content; backend writes null
 *   or empty string depending on the column's nullability)
 * - empty doc (single empty paragraph) -> ``null``
 * - otherwise -> ``JSON.stringify(doc)``
 *
 * The "empty doc" detector keeps a freshly mounted editor
 * with no user input from persisting a placeholder node.
 */
export function serializeEditorContent(doc: JSONContent | null): string | null {
    if (doc == null) return null;
    if (isEmptyDoc(doc)) return null;
    return JSON.stringify(doc);
}

/** Whether the doc is the editor's default empty state
 *  (one paragraph, no inline content). */
export function isEmptyDoc(doc: JSONContent): boolean {
    if (doc.type !== "doc") return false;
    const content = doc.content ?? [];
    if (content.length === 0) return true;
    if (content.length === 1) {
        const only = content[0];
        if (only.type !== "paragraph") return false;
        const inline = only.content ?? [];
        if (inline.length === 0) return true;
        return inline.every(
            (node) =>
                node.type === "text" &&
                typeof node.text === "string" &&
                node.text.trim().length === 0,
        );
    }
    return false;
}

/** Wrap legacy plain text as a TipTap doc with one paragraph
 *  per newline-delimited line. Empty lines become empty
 *  paragraphs (no inline content) which TipTap renders as
 *  vertical spacing. */
function wrapAsParagraphs(text: string): JSONContent {
    const lines = text.split(/\r?\n/);
    return {
        type: "doc",
        content: lines.map((line) => {
            if (line.length === 0) {
                return {type: "paragraph"};
            }
            return {
                type: "paragraph",
                content: [{type: "text", text: line}],
            };
        }),
    };
}

/**
 * Detect whether a stored value is legacy plain text (i.e.
 * NOT serialised TipTap JSON). Used by the export pipeline
 * to short-circuit the TipTap-to-Markdown converter for
 * legacy rows.
 */
export function isLegacyPlainText(stored: string | null | undefined): boolean {
    if (stored == null) return false;
    const trimmed = stored.trim();
    if (trimmed.length === 0) return false;
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return true;
    try {
        const candidate = JSON.parse(trimmed);
        return !looksLikeTipTapDoc(candidate);
    } catch {
        return true;
    }
}
