/**
 * Generic JSON conversation parser (Phase 12A).
 *
 * The escape hatch for sources that aren't ChatGPT or Claude.
 * Accepted shapes (any one):
 *
 *   1. ``{messages: [{role, content}]}``        (OpenAI-API-like)
 *   2. ``[{role, content}]``                    (bare array)
 *   3. ``{title?, messages: [...], model?}``    (envelope)
 *
 * ``role`` accepts ``user|assistant|system|human|claude|model``;
 * ``content`` MUST be a string (multimodal envelopes are out of
 * scope — the user should pre-flatten).
 */

import {ChatImportParseError, type NormalizedConversation, type NormalizedMessage} from "./types";

interface GenericMessageInput {
    role?: string;
    sender?: string;
    content?: unknown;
    text?: unknown;
    timestamp?: string;
    created_at?: string;
}

interface GenericEnvelope {
    title?: string;
    model?: string;
    source?: string;
    messages?: GenericMessageInput[];
    created_at?: string;
}

function normaliseRole(role: string | undefined): NormalizedMessage["role"] | null {
    if (typeof role !== "string") return null;
    const lc = role.toLowerCase();
    if (lc === "user" || lc === "human" || lc === "you") return "user";
    if (lc === "assistant" || lc === "claude" || lc === "model" || lc === "ai" || lc === "bot")
        return "assistant";
    if (lc === "system") return "system";
    return null;
}

function extractContent(input: GenericMessageInput): string {
    const candidates = [input.content, input.text];
    for (const cand of candidates) {
        if (typeof cand === "string" && cand.trim()) return cand;
    }
    return "";
}

function parseMessageArray(raw: GenericMessageInput[]): NormalizedMessage[] {
    const out: NormalizedMessage[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const role = normaliseRole(entry.role ?? entry.sender);
        if (role === null) continue;
        const content = extractContent(entry).trim();
        if (!content) continue;
        const msg: NormalizedMessage = {role, content};
        const ts = entry.timestamp ?? entry.created_at;
        if (typeof ts === "string" && ts) msg.timestamp = ts;
        out.push(msg);
    }
    return out;
}

export function parseGenericJson(raw: unknown): NormalizedConversation {
    if (Array.isArray(raw)) {
        const messages = parseMessageArray(raw as GenericMessageInput[]);
        if (messages.length === 0) {
            throw new ChatImportParseError(
                "Generic JSON array has no parseable messages",
                "unknown",
            );
        }
        return {
            source: "unknown",
            title: deriveTitle(messages, undefined),
            messages,
            metadata: {},
        };
    }
    if (raw && typeof raw === "object" && Array.isArray((raw as GenericEnvelope).messages)) {
        const envelope = raw as GenericEnvelope;
        const messages = parseMessageArray(envelope.messages ?? []);
        if (messages.length === 0) {
            throw new ChatImportParseError(
                "Generic JSON envelope has no parseable messages",
                "unknown",
            );
        }
        const source = matchKnownSource(envelope.source);
        const result: NormalizedConversation = {
            source,
            title: deriveTitle(messages, envelope.title),
            messages,
            metadata: {},
        };
        if (typeof envelope.model === "string" && envelope.model) {
            result.metadata.model = envelope.model;
        }
        if (typeof envelope.created_at === "string" && envelope.created_at) {
            result.metadata.created_at = envelope.created_at;
        }
        return result;
    }
    throw new ChatImportParseError(
        "Expected generic JSON {messages: [...]} or [...]",
        "unknown",
    );
}

function matchKnownSource(value: unknown): NormalizedConversation["source"] {
    if (typeof value !== "string") return "unknown";
    const lc = value.toLowerCase();
    if (lc === "chatgpt" || lc === "openai") return "chatgpt";
    if (lc === "claude" || lc === "anthropic") return "claude";
    if (lc === "gemini" || lc === "google") return "gemini";
    if (lc === "manual" || lc === "paste") return "manual";
    return "unknown";
}

function deriveTitle(
    messages: NormalizedMessage[],
    explicit: string | undefined,
): string {
    if (typeof explicit === "string" && explicit.trim()) {
        return explicit.trim();
    }
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
        const firstLine = firstUser.content.split(/\n/)[0]?.trim() ?? "";
        if (firstLine) {
            return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
        }
    }
    return "Imported conversation";
}

export function isGenericJsonShape(raw: unknown): boolean {
    if (Array.isArray(raw) && raw.length > 0) {
        const first = raw[0];
        return Boolean(
            first &&
                typeof first === "object" &&
                ("role" in first || "sender" in first) &&
                ("content" in first || "text" in first),
        );
    }
    if (raw && typeof raw === "object" && "messages" in raw) {
        return Array.isArray((raw as GenericEnvelope).messages);
    }
    return false;
}
