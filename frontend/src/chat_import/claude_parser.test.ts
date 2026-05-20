/**
 * Claude parser tests (Phase 12A).
 */

import {describe, it, expect} from "vitest";
import {
    isClaudeExport,
    parseClaudeConversation,
    parseClaudeExport,
} from "./claude_parser";
import {ChatImportParseError} from "./types";

function buildConvo(): unknown {
    return {
        uuid: "convo-1",
        name: "Sample Claude conversation",
        created_at: "2025-01-15T10:00:00Z",
        chat_messages: [
            {
                uuid: "m1",
                sender: "human",
                text: "How do I learn Python?",
                created_at: "2025-01-15T10:00:05Z",
            },
            {
                uuid: "m2",
                sender: "assistant",
                text: "Start with the official tutorial.",
                created_at: "2025-01-15T10:00:10Z",
            },
        ],
    };
}

describe("parseClaudeConversation", () => {
    it("maps human -> user and assistant -> assistant", () => {
        const result = parseClaudeConversation(buildConvo() as never);
        expect(result.source).toBe("claude");
        expect(result.title).toBe("Sample Claude conversation");
        expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
        expect(result.messages[0]?.timestamp).toBe("2025-01-15T10:00:05Z");
        expect(result.metadata.created_at).toBe("2025-01-15T10:00:00Z");
    });

    it("falls back to .content blocks when .text is empty", () => {
        const convo = {
            chat_messages: [
                {
                    sender: "human",
                    content: [
                        {type: "text", text: "Block A"},
                        {type: "image", source: {}},
                        {type: "text", text: "Block B"},
                    ],
                },
            ],
        };
        const result = parseClaudeConversation(convo as never);
        expect(result.messages[0]?.content).toBe("Block A\nBlock B");
    });

    it("accepts content as a plain string", () => {
        const convo = {
            chat_messages: [{sender: "assistant", content: "Inline string."}],
        };
        const result = parseClaudeConversation(convo as never);
        expect(result.messages[0]?.content).toBe("Inline string.");
    });

    it("throws when chat_messages is missing", () => {
        expect(() => parseClaudeConversation({} as never)).toThrow(ChatImportParseError);
    });

    it("throws when no parseable messages remain", () => {
        const convo = {chat_messages: [{sender: "human", text: ""}]};
        expect(() => parseClaudeConversation(convo as never)).toThrow(
            ChatImportParseError,
        );
    });

    it("gives a default title when name is missing", () => {
        const convo = buildConvo() as {name?: string};
        delete convo.name;
        const result = parseClaudeConversation(convo as never);
        expect(result.title).toBe("Untitled Claude conversation");
    });
});

describe("parseClaudeExport", () => {
    it("parses an array", () => {
        const result = parseClaudeExport([buildConvo(), buildConvo()]);
        expect(result.conversations.length).toBe(2);
        expect(result.warnings).toEqual([]);
    });

    it("parses a single conversation object", () => {
        const result = parseClaudeExport(buildConvo());
        expect(result.conversations.length).toBe(1);
    });

    it("collects warnings on malformed array entries", () => {
        const result = parseClaudeExport([buildConvo(), {chat_messages: []}]);
        expect(result.conversations.length).toBe(1);
        expect(result.warnings.length).toBe(1);
    });

    it("throws on unrecognisable shape", () => {
        expect(() => parseClaudeExport(42 as never)).toThrow(ChatImportParseError);
    });
});

describe("isClaudeExport", () => {
    it("recognises array shape", () => {
        expect(isClaudeExport([buildConvo()])).toBe(true);
    });

    it("recognises single conversation", () => {
        expect(isClaudeExport(buildConvo())).toBe(true);
    });

    it("rejects unrelated shapes", () => {
        expect(isClaudeExport({mapping: {}})).toBe(false);
        expect(isClaudeExport(null)).toBe(false);
    });
});
