/**
 * Chat-import dispatcher (Phase 12A).
 *
 * One entry point: ``parseChatImport(raw)``. Detects the source
 * shape and delegates to the right parser:
 *
 *   1. JSON parse the input (or accept a pre-parsed object).
 *   2. Sniff for ChatGPT export shape -> chatgpt_parser.
 *   3. Sniff for Claude export shape -> claude_parser.
 *   4. Sniff for generic ``{messages: [...]}`` -> generic_parser.
 *   5. Fall back to markdown_parser (plain text / paste).
 *
 * Pretty much every chat surface in the wild ends up matching
 * one of the four paths. The markdown fallback intentionally
 * never throws on shapeless input — it produces a single
 * user-role message containing the raw blob so the user gets
 * SOME signal back from the analysis layer.
 *
 * The dispatcher is the only place that decides what the
 * ``source`` field on the resulting NormalizedConversation will
 * be when the user pastes text; the individual parsers stamp
 * their canonical ``source`` value.
 */

import {parseChatGptExport, isChatGptExport, parseChatGptConversation} from "./chatgpt_parser";
import {parseClaudeExport, isClaudeExport, parseClaudeConversation} from "./claude_parser";
import {parseGenericJson, isGenericJsonShape} from "./generic_parser";
import {parseMarkdownConversation} from "./markdown_parser";
import {
    type BulkImportResult,
    ChatImportParseError,
    type NormalizedConversation,
} from "./types";

export interface ParseChatImportOptions {
    /** Title override for markdown fallback (e.g. filename). */
    title?: string;
    /** Force a specific format; skips auto-detect. */
    format?: "chatgpt" | "claude" | "generic" | "markdown" | "auto";
}

/**
 * Parse a raw input string (or pre-parsed JSON) into one or more
 * NormalizedConversation objects.
 *
 * Always returns a BulkImportResult — a single-conversation paste
 * produces ``conversations: [one]`` and the consumer doesn't need
 * to branch on shape.
 */
export function parseChatImport(
    input: string | unknown,
    options: ParseChatImportOptions = {},
): BulkImportResult {
    const format = options.format ?? "auto";

    // Try JSON parse first when the input is a string. JSON parse
    // failures fall through to the markdown path.
    const parsed: unknown =
        typeof input === "string" ? tryParseJson(input) : input;
    const isJson = parsed !== undefined && parsed !== null;

    if (format === "chatgpt") {
        if (!isJson) {
            throw new ChatImportParseError("ChatGPT format requires JSON input", "chatgpt");
        }
        return parseChatGptExport(parsed);
    }
    if (format === "claude") {
        if (!isJson) {
            throw new ChatImportParseError("Claude format requires JSON input", "claude");
        }
        return parseClaudeExport(parsed);
    }
    if (format === "generic") {
        if (!isJson) {
            throw new ChatImportParseError(
                "Generic JSON format requires JSON input",
                "unknown",
            );
        }
        return {conversations: [parseGenericJson(parsed)], warnings: []};
    }
    if (format === "markdown") {
        if (typeof input !== "string") {
            throw new ChatImportParseError(
                "Markdown format requires a string input",
                "manual",
            );
        }
        return {
            conversations: [parseMarkdownConversation(input, {title: options.title})],
            warnings: [],
        };
    }

    // Auto-detect.
    if (isJson) {
        if (isChatGptExport(parsed)) {
            return parseChatGptExport(parsed);
        }
        if (isClaudeExport(parsed)) {
            return parseClaudeExport(parsed);
        }
        if (isGenericJsonShape(parsed)) {
            return {conversations: [parseGenericJson(parsed)], warnings: []};
        }
        // Single-conversation ChatGPT object (not in an array)?
        if (
            parsed &&
            typeof parsed === "object" &&
            "mapping" in parsed &&
            "current_node" in parsed
        ) {
            return {
                conversations: [
                    parseChatGptConversation(parsed as Parameters<typeof parseChatGptConversation>[0]),
                ],
                warnings: [],
            };
        }
        // Single-conversation Claude object?
        if (parsed && typeof parsed === "object" && "chat_messages" in parsed) {
            return {
                conversations: [
                    parseClaudeConversation(parsed as Parameters<typeof parseClaudeConversation>[0]),
                ],
                warnings: [],
            };
        }
    }
    if (typeof input === "string" && input.trim()) {
        return {
            conversations: [parseMarkdownConversation(input, {title: options.title})],
            warnings: [],
        };
    }
    throw new ChatImportParseError(
        "Could not recognise the input format",
        "unknown",
    );
}

/**
 * Quick auto-detect helper for the UI: returns the format name
 * the parser would choose, without running it. Lets the import
 * page label the file before the parse pass.
 */
export function detectFormat(
    input: string | unknown,
): "chatgpt" | "claude" | "generic" | "markdown" | "unknown" {
    const parsed: unknown =
        typeof input === "string" ? tryParseJson(input) : input;
    if (parsed !== undefined && parsed !== null) {
        if (isChatGptExport(parsed)) return "chatgpt";
        if (
            parsed &&
            typeof parsed === "object" &&
            "mapping" in parsed &&
            "current_node" in parsed
        ) {
            return "chatgpt";
        }
        if (isClaudeExport(parsed)) return "claude";
        if (
            parsed &&
            typeof parsed === "object" &&
            "chat_messages" in parsed
        ) {
            return "claude";
        }
        if (isGenericJsonShape(parsed)) return "generic";
    }
    if (typeof input === "string" && input.trim()) return "markdown";
    return "unknown";
}

function tryParseJson(raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
    try {
        return JSON.parse(trimmed);
    } catch {
        return undefined;
    }
}

/** Aggregate message count across every conversation in the result. */
export function totalMessageCount(result: BulkImportResult): number {
    return result.conversations.reduce((sum, c) => sum + c.messages.length, 0);
}

export * from "./types";
export {parseChatGptExport, parseChatGptConversation, isChatGptExport} from "./chatgpt_parser";
export {parseClaudeExport, parseClaudeConversation, isClaudeExport} from "./claude_parser";
export {parseMarkdownConversation} from "./markdown_parser";
export {parseGenericJson, isGenericJsonShape} from "./generic_parser";
