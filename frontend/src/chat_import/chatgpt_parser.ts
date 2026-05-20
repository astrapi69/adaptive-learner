/**
 * ChatGPT export parser (Phase 12A).
 *
 * ChatGPT's "Export data" feature (Settings -> Data Controls ->
 * Export) ships a ZIP whose ``conversations.json`` is an array
 * of conversation objects. Each conversation has:
 *
 *   - ``title``: free-text title
 *   - ``create_time`` / ``update_time``: unix seconds (float)
 *   - ``mapping``: a dict of node id -> node, encoding the
 *     conversation tree (regenerations + edits branch the tree)
 *   - ``current_node``: leaf id of the canonical thread
 *
 * To produce a linear transcript we walk UP from ``current_node``
 * via ``parent`` until we hit the root, then reverse. This gives
 * the canonical user-chosen path through the tree and ignores
 * abandoned regeneration branches.
 *
 * Each node's ``message`` is the actual message; ``message`` can
 * be ``null`` for synthetic root nodes — those are skipped.
 *
 * The parser is defensive: malformed nodes are skipped with a
 * warning rather than aborting the whole conversation.
 */

import {ChatImportParseError, type NormalizedConversation, type NormalizedMessage} from "./types";

interface ChatGptNode {
    id?: string;
    message?: {
        id?: string;
        author?: {role?: string};
        content?: {
            content_type?: string;
            parts?: unknown[];
        };
        create_time?: number | null;
        metadata?: {model_slug?: string};
    } | null;
    parent?: string | null;
    children?: string[];
}

interface ChatGptConversation {
    title?: string;
    create_time?: number;
    update_time?: number;
    mapping?: Record<string, ChatGptNode>;
    current_node?: string;
    /** Newer exports include ``default_model_slug``. */
    default_model_slug?: string;
}

const SYSTEM_ROLE_MARKERS = new Set(["system", "tool"]);

function normaliseRole(role: string | undefined): NormalizedMessage["role"] | null {
    if (typeof role !== "string") return null;
    const lc = role.toLowerCase();
    if (lc === "user") return "user";
    if (lc === "assistant") return "assistant";
    if (SYSTEM_ROLE_MARKERS.has(lc)) return "system";
    return null;
}

function joinParts(parts: unknown[] | undefined): string {
    if (!Array.isArray(parts)) return "";
    const out: string[] = [];
    for (const part of parts) {
        if (typeof part === "string") {
            out.push(part);
            continue;
        }
        // Multimodal parts arrive as objects; pull out the text
        // field if present, otherwise skip silently.
        if (part && typeof part === "object" && "text" in part) {
            const text = (part as {text?: unknown}).text;
            if (typeof text === "string") out.push(text);
        }
    }
    return out.join("\n").trim();
}

function isoFromUnix(unix: number | null | undefined): string | undefined {
    if (typeof unix !== "number" || !Number.isFinite(unix)) return undefined;
    return new Date(unix * 1000).toISOString();
}

/**
 * Walk from ``current_node`` up via ``parent``, then reverse. The
 * walk is bounded by the mapping size so a self-referential cycle
 * in malformed input still terminates.
 */
function linearizeMapping(
    mapping: Record<string, ChatGptNode>,
    leafId: string,
): ChatGptNode[] {
    const path: ChatGptNode[] = [];
    const seen = new Set<string>();
    let cursor: string | null | undefined = leafId;
    while (cursor && !seen.has(cursor) && path.length < 50_000) {
        seen.add(cursor);
        const node: ChatGptNode | undefined = mapping[cursor];
        if (!node) break;
        path.push(node);
        cursor = node.parent;
    }
    return path.reverse();
}

/**
 * Parse a single ChatGPT conversation object.
 *
 * @throws {ChatImportParseError} when the input has no recoverable
 *   message content. Conversations with zero recognisable
 *   messages are useless to import.
 */
export function parseChatGptConversation(
    convo: ChatGptConversation,
): NormalizedConversation {
    if (
        !convo ||
        typeof convo !== "object" ||
        !convo.mapping ||
        typeof convo.mapping !== "object"
    ) {
        throw new ChatImportParseError(
            "ChatGPT conversation has no mapping",
            "chatgpt",
        );
    }
    const leaf =
        typeof convo.current_node === "string" && convo.current_node in convo.mapping
            ? convo.current_node
            : // Fallback: pick any leaf (a node nobody points at via children).
              findLeaf(convo.mapping);
    if (!leaf) {
        throw new ChatImportParseError(
            "ChatGPT conversation has no current_node",
            "chatgpt",
        );
    }
    const path = linearizeMapping(convo.mapping, leaf);
    const messages: NormalizedMessage[] = [];
    let model: string | undefined;
    for (const node of path) {
        const msg = node.message;
        if (!msg) continue;
        const role = normaliseRole(msg.author?.role);
        if (role === null) continue;
        const text = joinParts(msg.content?.parts);
        if (!text) continue;
        const timestamp = isoFromUnix(msg.create_time ?? null);
        const entry: NormalizedMessage = {role, content: text};
        if (timestamp) entry.timestamp = timestamp;
        messages.push(entry);
        if (!model && msg.metadata?.model_slug) {
            model = msg.metadata.model_slug;
        }
    }
    if (messages.length === 0) {
        throw new ChatImportParseError(
            "ChatGPT conversation has no parseable messages",
            "chatgpt",
        );
    }
    const title = typeof convo.title === "string" && convo.title.trim()
        ? convo.title.trim()
        : "Untitled ChatGPT conversation";
    const created_at = isoFromUnix(convo.create_time);
    const result: NormalizedConversation = {
        source: "chatgpt",
        title,
        messages,
        metadata: {},
    };
    if (model ?? convo.default_model_slug) {
        result.metadata.model = model ?? convo.default_model_slug;
    }
    if (created_at) result.metadata.created_at = created_at;
    return result;
}

function findLeaf(mapping: Record<string, ChatGptNode>): string | null {
    for (const [id, node] of Object.entries(mapping)) {
        if (!node) continue;
        if (!node.children || node.children.length === 0) {
            // Skip the synthetic root (no message, no parent).
            if (!node.message && !node.parent) continue;
            return id;
        }
    }
    return null;
}

/**
 * Parse the full ChatGPT export array. Returns one conversation
 * per array entry. Malformed entries are skipped with a warning.
 */
export function parseChatGptExport(
    raw: unknown,
): {conversations: NormalizedConversation[]; warnings: string[]} {
    if (!Array.isArray(raw)) {
        // Some recent exports nest conversations under a top-level
        // ``{conversations: [...]}`` envelope.
        if (
            raw &&
            typeof raw === "object" &&
            "conversations" in raw &&
            Array.isArray((raw as {conversations: unknown}).conversations)
        ) {
            return parseChatGptExport((raw as {conversations: unknown}).conversations);
        }
        // Single-conversation object (no envelope). Wrap it so the
        // dispatcher does not have to special-case the shape.
        if (
            raw &&
            typeof raw === "object" &&
            "mapping" in raw &&
            "current_node" in raw
        ) {
            return parseChatGptExport([raw]);
        }
        throw new ChatImportParseError(
            "Expected an array of ChatGPT conversations",
            "chatgpt",
        );
    }
    const conversations: NormalizedConversation[] = [];
    const warnings: string[] = [];
    raw.forEach((entry, idx) => {
        try {
            conversations.push(parseChatGptConversation(entry as ChatGptConversation));
        } catch (err) {
            const detail =
                err instanceof Error ? err.message : "unknown parse error";
            warnings.push(`Skipped ChatGPT conversation #${idx + 1}: ${detail}`);
        }
    });
    return {conversations, warnings};
}

/**
 * Recognise the ChatGPT export shape. Used by the auto-detect
 * dispatcher; intentionally cheap (no full parse).
 */
export function isChatGptExport(raw: unknown): boolean {
    if (Array.isArray(raw) && raw.length > 0) {
        const first = raw[0];
        return Boolean(
            first &&
                typeof first === "object" &&
                "mapping" in first &&
                typeof (first as {mapping: unknown}).mapping === "object",
        );
    }
    if (raw && typeof raw === "object" && "mapping" in raw && "current_node" in raw) {
        return true;
    }
    if (
        raw &&
        typeof raw === "object" &&
        "conversations" in raw &&
        Array.isArray((raw as {conversations: unknown}).conversations)
    ) {
        return isChatGptExport((raw as {conversations: unknown[]}).conversations);
    }
    return false;
}
