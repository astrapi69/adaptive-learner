/**
 * Markdown / plain-text conversation parser (Phase 12A).
 *
 * The 80% case for chat-history import is copy-paste: a learner
 * pulls a ChatGPT / Claude / Gemini conversation into a text
 * field and expects it to "just work". This parser splits the
 * pasted blob into role-tagged messages by recognising the role
 * markers humans (and chat UIs) use:
 *
 *   - ``**You:**``, ``**User:**``, ``**Human:**`` -> user
 *   - ``**ChatGPT:**``, ``**Assistant:**``, ``**Claude:**``,
 *     ``**Gemini:**``, ``**AI:**``, ``**Bot:**`` -> assistant
 *   - ``You:``, ``Assistant:`` (plain) -> same as above
 *   - ``# You``, ``## Assistant`` (markdown headings) -> same
 *
 * A marker MUST start a line (after optional whitespace). Body
 * text after a marker accumulates until the next marker. Content
 * before the first marker is treated as a system preamble when
 * non-empty; otherwise dropped silently.
 *
 * The parser is intentionally permissive: even when no markers
 * are recognised at all it falls back to "one big user message"
 * so the user gets *something* analysable. The UI surfaces a
 * warning when the fallback fired.
 */

import {ChatImportParseError, type NormalizedConversation, type NormalizedMessage} from "./types";

const USER_MARKERS = [
    "you",
    "user",
    "human",
    "me",
    "learner",
    "student",
    "frage",
    "ich",
    "du",
    "benutzer",
];
const ASSISTANT_MARKERS = [
    "assistant",
    "chatgpt",
    "claude",
    "gemini",
    "ai",
    "bot",
    "model",
    "antwort",
    "ki",
];

interface ParsedMarker {
    role: NormalizedMessage["role"];
    /** Length of the consumed prefix (marker + delimiter). */
    consumed: number;
}

/**
 * Try to recognise a role marker at the START of a line. Returns
 * ``null`` when the line does not start with a marker.
 *
 * Accepted shapes (case-insensitive):
 *   ``**Name:**``, ``__Name:__``, ``Name:``, ``# Name``, ``## Name``,
 *   ``> Name:``.
 */
function recogniseMarker(line: string): ParsedMarker | null {
    const stripped = line.replace(/^\s+/, "");
    // ``> `` blockquote prefix is common in some chat exports.
    const noQuote = stripped.replace(/^>\s*/, "");
    // ``## `` markdown heading prefix.
    const headingMatch = noQuote.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
        const inner = headingMatch[1].trim().replace(/[*_]+/g, "").replace(/:$/, "").trim();
        const role = classifyName(inner);
        if (role) {
            return {role, consumed: line.length};
        }
    }
    // ``**Name:**`` / ``__Name:__`` (bold, possibly with colon inside).
    const boldMatch = noQuote.match(/^(?:\*\*|__)([^*_\n]+?)(?:\*\*|__):?\s*/);
    if (boldMatch) {
        const inner = boldMatch[1].replace(/:$/, "").trim();
        const role = classifyName(inner);
        if (role) {
            const idx = line.indexOf(boldMatch[0]) + boldMatch[0].length;
            return {role, consumed: idx};
        }
    }
    // ``**Name**:`` (bold name THEN colon outside the bold).
    const boldThenColon = noQuote.match(/^(?:\*\*|__)([^*_\n]+?)(?:\*\*|__)\s*:\s*/);
    if (boldThenColon) {
        const inner = boldThenColon[1].replace(/:$/, "").trim();
        const role = classifyName(inner);
        if (role) {
            const idx = line.indexOf(boldThenColon[0]) + boldThenColon[0].length;
            return {role, consumed: idx};
        }
    }
    // ``Name:`` plain marker.
    const plainMatch = noQuote.match(/^([A-Za-z]{2,20})\s*:\s+/);
    if (plainMatch) {
        const role = classifyName(plainMatch[1]);
        if (role) {
            const idx = line.indexOf(plainMatch[0]) + plainMatch[0].length;
            return {role, consumed: idx};
        }
    }
    return null;
}

function classifyName(raw: string): NormalizedMessage["role"] | null {
    const lc = raw.trim().toLowerCase();
    if (USER_MARKERS.includes(lc)) return "user";
    if (ASSISTANT_MARKERS.includes(lc)) return "assistant";
    if (lc === "system") return "system";
    return null;
}

interface ParseMarkdownOptions {
    /** Title fallback if no first user message exists. */
    title?: string;
}

/**
 * Parse a free-form markdown / plain-text conversation. Always
 * returns a NormalizedConversation; in the no-markers-found case
 * the whole input becomes a single user message and the
 * ``messages`` array length is 1.
 *
 * @throws {ChatImportParseError} only when ``raw`` is empty or
 *   not a string. Everything else falls back to the single-user-
 *   message shape.
 */
export function parseMarkdownConversation(
    raw: string,
    options: ParseMarkdownOptions = {},
): NormalizedConversation {
    if (typeof raw !== "string" || raw.trim() === "") {
        throw new ChatImportParseError(
            "Markdown input is empty",
            "manual",
        );
    }
    const lines = raw.split(/\r?\n/);
    const messages: NormalizedMessage[] = [];
    let currentRole: NormalizedMessage["role"] | null = null;
    let buffer: string[] = [];
    const flush = () => {
        if (currentRole === null) return;
        const content = buffer.join("\n").trim();
        if (content) {
            messages.push({role: currentRole, content});
        }
        buffer = [];
    };
    for (const line of lines) {
        const marker = recogniseMarker(line);
        if (marker) {
            flush();
            currentRole = marker.role;
            const remainder = line.slice(marker.consumed);
            if (remainder.trim()) buffer.push(remainder);
        } else if (currentRole !== null) {
            buffer.push(line);
        } else {
            // Pre-marker preamble: collect into a system message.
            buffer.push(line);
        }
    }
    // The trailing accumulator either belongs to the current role,
    // or — if we never saw a marker — becomes the implicit user
    // message for the no-markers fallback.
    if (currentRole === null) {
        const content = raw.trim();
        return buildResult([{role: "user", content}], options.title, raw);
    }
    flush();
    if (messages.length === 0) {
        // Marker recognised but only whitespace bodies — fall back.
        return buildResult(
            [{role: "user", content: raw.trim()}],
            options.title,
            raw,
        );
    }
    return buildResult(messages, options.title, raw);
}

function buildResult(
    messages: NormalizedMessage[],
    titleOverride: string | undefined,
    raw: string,
): NormalizedConversation {
    const title =
        titleOverride?.trim() ||
        deriveTitleFromHeading(raw) ||
        deriveTitleFromFirstUserMessage(messages) ||
        "Pasted conversation";
    return {
        source: "manual",
        title,
        messages,
        metadata: {},
    };
}

function deriveTitleFromFirstUserMessage(
    messages: NormalizedMessage[],
): string | null {
    const first = messages.find((m) => m.role === "user");
    if (!first) return null;
    const firstLine = first.content.split(/\n/)[0]?.trim() ?? "";
    if (!firstLine) return null;
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
}

function deriveTitleFromHeading(raw: string): string | null {
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const heading = trimmed.match(/^#\s+(.+)$/);
        if (heading) {
            const inner = heading[1].trim();
            return inner.length > 80 ? `${inner.slice(0, 77)}…` : inner;
        }
        // Only check the first non-empty line.
        break;
    }
    return null;
}
