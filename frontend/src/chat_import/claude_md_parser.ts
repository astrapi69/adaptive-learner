/**
 * Claude.ai per-conversation Markdown export parser (BL-25 / BL-26 / BL-28).
 *
 * Claude.ai ships TWO export shapes:
 *
 *  - The bulk JSON export (Settings -> Account -> Export data),
 *    handled by ``claude_parser.ts``.
 *  - The per-conversation **Markdown** export from inside a chat
 *    (the in-product `Export as Markdown` button) — handled here.
 *
 * The Markdown shape:
 *
 *   # <Title>
 *
 *   **Created:** M/D/YYYY HH:MM:SS
 *   **Updated:** M/D/YYYY HH:MM:SS
 *   **Exported:** M/D/YYYY HH:MM:SS
 *   **Link:** [https://claude.ai/chat/<uuid>](...)
 *
 *   ## Prompt:
 *   D.M.YYYY, HH:MM:SS
 *
 *   <user-text — may include any markdown EXCEPT a literal
 *   ``## Prompt:`` / ``## Response:`` line at column 0; internal
 *   ``## Some Other Heading`` is fine and stays inside the body>
 *
 *   ## Response:
 *   D.M.YYYY, HH:MM:SS
 *
 *   <assistant-text — same rules; may contain ```plaintext fenced
 *   tool/thought blocks that stay part of the body>
 *
 *   ... repeats N times ...
 *
 * Turn boundaries are exact-string matches on a trimmed line:
 * ``## Prompt:`` or ``## Response:``. Anything else (internal
 * H2 headers like ``## Diagnose-Runde: Wo stehst du?``) belongs
 * to the body of the surrounding turn — that's why the generic
 * markdown_parser (which splits on ANY ``## Word`` heading) was
 * wrong for this format.
 *
 * Per-turn timestamps land in ``NormalizedMessage.timestamp`` as
 * ISO-8601 strings (local-time naive, no Z, no offset — the
 * source carries no timezone). Consumers must be tolerant of
 * both Z-suffixed and naive ISO strings, same as the JSON
 * Claude parser.
 */

import {
    ChatImportParseError,
    type NormalizedConversation,
    type NormalizedMessage,
} from "./types";

const PROMPT_HEADER = "## Prompt:";
const RESPONSE_HEADER = "## Response:";

/** ``D.M.YYYY, HH:MM:SS`` — German locale, optional single-digit
 * day/month. Seconds are always two digits. */
const TURN_TIMESTAMP_RE =
    /^(\d{1,2})\.(\d{1,2})\.(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*$/;

const H1_RE = /^#\s+(.+?)\s*$/;
const CREATED_RE = /^\*\*Created:\*\*\s*(.+?)\s*$/;
/** Look for the canonical Claude chat link as a signature. The
 * loose form ``https://claude.ai/chat/`` is enough — the UUID
 * has no further structural value at parse time. */
const CLAUDE_LINK_SNIFF =
    /\*\*Link:\*\*\s*\[?https?:\/\/claude\.ai\/chat\//i;

function normaliseTimestamp(m: RegExpMatchArray): string {
    const [, d, mo, y, h, mm, s] = m;
    const dd = d.padStart(2, "0");
    const mn = mo.padStart(2, "0");
    const hh = h.padStart(2, "0");
    return `${y}-${mn}-${dd}T${hh}:${mm}:${s}`;
}

/**
 * Sniff for the Claude.ai per-conversation Markdown export
 * signature. Cheap check used by the dispatcher auto-detect.
 *
 * All three conditions must hold:
 *  1. The first non-blank line is an H1 (``# Title``).
 *  2. The head of the file contains ``**Link:** https://claude.ai/chat/...``.
 *  3. At least one ``## Prompt:`` boundary exists.
 */
export function isClaudeMarkdownExport(raw: unknown): boolean {
    if (typeof raw !== "string") return false;
    if (raw.length < 20) return false;
    const head = raw.slice(0, 2048);
    const firstNonBlank = head.split(/\r?\n/).find((l) => l.trim() !== "");
    if (!firstNonBlank || !H1_RE.test(firstNonBlank)) return false;
    if (!CLAUDE_LINK_SNIFF.test(head)) return false;
    if (!raw.includes(PROMPT_HEADER)) return false;
    return true;
}

interface TurnBoundary {
    idx: number;
    role: NormalizedMessage["role"];
}

function findBoundaries(lines: readonly string[]): TurnBoundary[] {
    const out: TurnBoundary[] = [];
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === PROMPT_HEADER) out.push({idx: i, role: "user"});
        else if (trimmed === RESPONSE_HEADER) out.push({idx: i, role: "assistant"});
    }
    return out;
}

function extractTitle(lines: readonly string[]): string {
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        const m = line.match(H1_RE);
        if (m) return m[1].trim();
        // First non-blank line wasn't an H1 — stop, fall back below.
        break;
    }
    return "Untitled Claude conversation";
}

function extractCreatedAt(lines: readonly string[]): string | undefined {
    // The metadata block lives in the first ~20 lines. Don't scan
    // the whole file — there are no ``**Created:**`` lines in
    // legitimate body content.
    const limit = Math.min(lines.length, 30);
    for (let i = 0; i < limit; i++) {
        const m = lines[i].match(CREATED_RE);
        if (m) return m[1];
    }
    return undefined;
}

/**
 * Parse a Claude.ai per-conversation Markdown export into a
 * NormalizedConversation. Throws ChatImportParseError when:
 *
 *   - The input is empty / not a string.
 *   - The input has no ``## Prompt:`` or ``## Response:``
 *     boundaries (i.e. it's not actually a Claude .md export).
 *   - Every turn produces an empty body (no parseable messages).
 *
 * The caller (auto-detect in index.ts) is responsible for
 * gating this parser with ``isClaudeMarkdownExport`` so the
 * "no boundaries" throw stays narrow.
 */
export function parseClaudeMarkdownExport(raw: string): NormalizedConversation {
    if (typeof raw !== "string" || raw.trim() === "") {
        throw new ChatImportParseError(
            "Claude Markdown export input is empty",
            "claude",
        );
    }
    const lines = raw.split(/\r?\n/);
    const boundaries = findBoundaries(lines);
    if (boundaries.length === 0) {
        throw new ChatImportParseError(
            "Claude Markdown export has no ## Prompt: or ## Response: headers",
            "claude",
        );
    }
    const messages: NormalizedMessage[] = [];
    for (let i = 0; i < boundaries.length; i++) {
        const start = boundaries[i].idx + 1;
        const end = i + 1 < boundaries.length ? boundaries[i + 1].idx : lines.length;
        let cursor = start;
        // Skip blank lines between the header and the timestamp /
        // body. Real exports always have one blank line here, but
        // be permissive.
        while (cursor < end && lines[cursor].trim() === "") cursor++;
        // Read timestamp ON THE FIRST CONTENT LINE only. If the
        // line doesn't match the timestamp shape, fall through to
        // body — the export may have been hand-edited or come
        // from a future Claude.ai variant without per-turn times.
        let timestamp: string | undefined;
        if (cursor < end) {
            const tm = lines[cursor].match(TURN_TIMESTAMP_RE);
            if (tm) {
                timestamp = normaliseTimestamp(tm);
                cursor++;
            }
        }
        const body = lines.slice(cursor, end).join("\n").trim();
        if (!body) continue;
        const entry: NormalizedMessage = {role: boundaries[i].role, content: body};
        if (timestamp) entry.timestamp = timestamp;
        messages.push(entry);
    }
    if (messages.length === 0) {
        throw new ChatImportParseError(
            "Claude Markdown export has no parseable message bodies",
            "claude",
        );
    }
    const title = extractTitle(lines);
    const createdAt = extractCreatedAt(lines);
    const result: NormalizedConversation = {
        source: "claude",
        title,
        messages,
        metadata: {},
    };
    if (createdAt) result.metadata.created_at = createdAt;
    return result;
}
