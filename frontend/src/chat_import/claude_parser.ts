/**
 * Claude (claude.ai) export parser (Phase 12A).
 *
 * Anthropic's "Export data" feature (Settings -> Account ->
 * Export data) ships a JSON file whose shape depends on the
 * vintage of the export:
 *
 *   - Newer (2024+): an array of conversation objects.
 *   - Older / single-conversation exports: one conversation
 *     object at the top level.
 *
 * Each conversation has:
 *
 *   - ``uuid``: stable id
 *   - ``name``: human-readable title
 *   - ``created_at``: ISO 8601 string
 *   - ``chat_messages``: array of {uuid, sender, text, created_at}
 *
 * ``sender`` is ``"human"`` or ``"assistant"`` (Anthropic's
 * vocabulary; we normalise to ``"user"`` / ``"assistant"``).
 * Some newer exports also carry ``content`` as a list of blocks
 * (multi-modal); we concatenate the ``text`` blocks.
 */

import {ChatImportParseError, type NormalizedConversation, type NormalizedMessage} from "./types";

interface ClaudeContentBlock {
    type?: string;
    text?: string;
}

interface ClaudeMessage {
    uuid?: string;
    sender?: string;
    text?: string;
    content?: ClaudeContentBlock[] | string;
    created_at?: string;
}

interface ClaudeConversation {
    uuid?: string;
    name?: string;
    created_at?: string;
    chat_messages?: ClaudeMessage[];
}

function normaliseRole(sender: string | undefined): NormalizedMessage["role"] | null {
    if (typeof sender !== "string") return null;
    const lc = sender.toLowerCase();
    if (lc === "human" || lc === "user") return "user";
    if (lc === "assistant" || lc === "claude") return "assistant";
    if (lc === "system") return "system";
    return null;
}

function extractText(msg: ClaudeMessage): string {
    // Prefer ``text`` (the older shape) when present and non-empty.
    if (typeof msg.text === "string" && msg.text.trim()) return msg.text.trim();
    if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
    if (Array.isArray(msg.content)) {
        const parts: string[] = [];
        for (const block of msg.content) {
            if (block && typeof block.text === "string") parts.push(block.text);
        }
        return parts.join("\n").trim();
    }
    return "";
}

export function parseClaudeConversation(
    convo: ClaudeConversation,
): NormalizedConversation {
    if (!convo || typeof convo !== "object" || !Array.isArray(convo.chat_messages)) {
        throw new ChatImportParseError(
            "Claude conversation has no chat_messages",
            "claude",
        );
    }
    const messages: NormalizedMessage[] = [];
    for (const msg of convo.chat_messages) {
        const role = normaliseRole(msg.sender);
        if (role === null) continue;
        const text = extractText(msg);
        if (!text) continue;
        const entry: NormalizedMessage = {role, content: text};
        if (typeof msg.created_at === "string" && msg.created_at) {
            entry.timestamp = msg.created_at;
        }
        messages.push(entry);
    }
    if (messages.length === 0) {
        throw new ChatImportParseError(
            "Claude conversation has no parseable messages",
            "claude",
        );
    }
    const title =
        typeof convo.name === "string" && convo.name.trim()
            ? convo.name.trim()
            : "Untitled Claude conversation";
    const result: NormalizedConversation = {
        source: "claude",
        title,
        messages,
        metadata: {},
    };
    if (typeof convo.created_at === "string" && convo.created_at) {
        result.metadata.created_at = convo.created_at;
    }
    return result;
}

export function parseClaudeExport(
    raw: unknown,
): {conversations: NormalizedConversation[]; warnings: string[]} {
    if (Array.isArray(raw)) {
        const conversations: NormalizedConversation[] = [];
        const warnings: string[] = [];
        raw.forEach((entry, idx) => {
            try {
                conversations.push(parseClaudeConversation(entry as ClaudeConversation));
            } catch (err) {
                const detail = err instanceof Error ? err.message : "unknown parse error";
                warnings.push(`Skipped Claude conversation #${idx + 1}: ${detail}`);
            }
        });
        return {conversations, warnings};
    }
    if (raw && typeof raw === "object" && "chat_messages" in raw) {
        return {
            conversations: [parseClaudeConversation(raw as ClaudeConversation)],
            warnings: [],
        };
    }
    throw new ChatImportParseError(
        "Expected Claude conversation object or array",
        "claude",
    );
}

/** Cheap shape sniff for auto-detect. */
export function isClaudeExport(raw: unknown): boolean {
    if (Array.isArray(raw) && raw.length > 0) {
        const first = raw[0];
        return Boolean(
            first &&
                typeof first === "object" &&
                "chat_messages" in first &&
                Array.isArray((first as {chat_messages: unknown}).chat_messages),
        );
    }
    if (raw && typeof raw === "object" && "chat_messages" in raw) {
        return Array.isArray((raw as {chat_messages: unknown}).chat_messages);
    }
    return false;
}
