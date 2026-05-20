/**
 * Chat-import normalized shapes (Phase 12A).
 *
 * Every parser in ``frontend/src/chat_import/`` reduces its
 * source-specific format to the same ``NormalizedConversation``
 * shape. Downstream consumers (storage layer, analysis engine,
 * UI) only know about this shape.
 *
 * The source string identifies the parser that produced the
 * conversation. Useful for the source-icon in the conversation
 * list and for telemetry-grade analytics later.
 */

export type ChatImportSource =
    | "chatgpt"
    | "claude"
    | "gemini"
    | "manual"
    | "unknown";

export type NormalizedRole = "user" | "assistant" | "system";

export interface NormalizedMessage {
    role: NormalizedRole;
    content: string;
    /** ISO 8601 string when the source carried a timestamp. */
    timestamp?: string;
}

export interface NormalizedConversation {
    source: ChatImportSource;
    /** Human-readable title. Parsers derive from filename / first
     * user message / source-specific title field when absent. */
    title: string;
    messages: NormalizedMessage[];
    metadata: {
        /** AI model name when carried in the source. */
        model?: string;
        /** Detected topic from the source. */
        topic?: string;
        /** ISO 8601 source creation timestamp when available. */
        created_at?: string;
    };
}

/**
 * Result of bulk-import. Multi-conversation ChatGPT/Claude exports
 * produce many conversations from one file.
 */
export interface BulkImportResult {
    conversations: NormalizedConversation[];
    /** Per-conversation parse warnings (skipped malformed entries,
     * empty conversations, etc.). Not fatal — the conversations
     * array still contains the parseable ones. */
    warnings: string[];
}

/**
 * Raised by parsers when the input is unrecognisable as the
 * declared format. Caller (auto-detect or UI) catches and falls
 * back to a clear error message.
 */
export class ChatImportParseError extends Error {
    constructor(
        message: string,
        public readonly source?: ChatImportSource,
    ) {
        super(message);
        this.name = "ChatImportParseError";
    }
}
