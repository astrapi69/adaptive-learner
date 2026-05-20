/**
 * ChatGPT parser tests (Phase 12A).
 *
 * Fixtures are hand-crafted to match real ChatGPT export shapes
 * without any real conversation data.
 */

import {describe, it, expect} from "vitest";
import {
    isChatGptExport,
    parseChatGptConversation,
    parseChatGptExport,
} from "./chatgpt_parser";
import {ChatImportParseError} from "./types";

function buildConvo(): unknown {
    return {
        title: "Anonymized sample",
        create_time: 1_700_000_000.0,
        update_time: 1_700_000_500.0,
        default_model_slug: "gpt-4o-mini",
        mapping: {
            root: {id: "root", message: null, parent: null, children: ["m1"]},
            m1: {
                id: "m1",
                message: {
                    id: "m1",
                    author: {role: "system"},
                    content: {content_type: "text", parts: ["You are a helpful tutor."]},
                    create_time: 1_700_000_010.0,
                },
                parent: "root",
                children: ["m2"],
            },
            m2: {
                id: "m2",
                message: {
                    id: "m2",
                    author: {role: "user"},
                    content: {content_type: "text", parts: ["Explain induction."]},
                    create_time: 1_700_000_020.0,
                    metadata: {model_slug: "gpt-4o-mini"},
                },
                parent: "m1",
                children: ["m3"],
            },
            m3: {
                id: "m3",
                message: {
                    id: "m3",
                    author: {role: "assistant"},
                    content: {content_type: "text", parts: ["Induction is..."]},
                    create_time: 1_700_000_030.0,
                    metadata: {model_slug: "gpt-4o-mini"},
                },
                parent: "m2",
                children: [],
            },
        },
        current_node: "m3",
    };
}

describe("parseChatGptConversation", () => {
    it("returns the linear path from current_node up", () => {
        const result = parseChatGptConversation(buildConvo() as never);
        expect(result.source).toBe("chatgpt");
        expect(result.title).toBe("Anonymized sample");
        expect(result.messages.map((m) => m.role)).toEqual([
            "system",
            "user",
            "assistant",
        ]);
        expect(result.messages[1]?.content).toBe("Explain induction.");
        expect(result.metadata.model).toBe("gpt-4o-mini");
        expect(result.metadata.created_at).toBeDefined();
    });

    it("skips synthetic root nodes (no message)", () => {
        const convo = buildConvo() as {mapping: Record<string, unknown>};
        const result = parseChatGptConversation(convo as never);
        // Root has message: null and must not become a message.
        expect(result.messages.length).toBe(3);
    });

    it("joins multi-part text content", () => {
        const convo = {
            title: "multi",
            mapping: {
                a: {
                    id: "a",
                    message: {
                        author: {role: "user"},
                        content: {content_type: "text", parts: ["Hello", "world"]},
                    },
                    parent: null,
                    children: [],
                },
            },
            current_node: "a",
        };
        const result = parseChatGptConversation(convo as never);
        expect(result.messages[0]?.content).toBe("Hello\nworld");
    });

    it("handles object-shaped parts with .text", () => {
        const convo = {
            mapping: {
                a: {
                    id: "a",
                    message: {
                        author: {role: "user"},
                        content: {
                            content_type: "multimodal_text",
                            parts: [{text: "Image follows"}, {asset_pointer: "..."}],
                        },
                    },
                    parent: null,
                    children: [],
                },
            },
            current_node: "a",
        };
        const result = parseChatGptConversation(convo as never);
        expect(result.messages[0]?.content).toBe("Image follows");
    });

    it("throws ChatImportParseError when mapping is missing", () => {
        expect(() => parseChatGptConversation({} as never)).toThrow(ChatImportParseError);
    });

    it("throws when no parseable messages", () => {
        const convo = {
            mapping: {
                a: {
                    id: "a",
                    message: {author: {role: "user"}, content: {parts: [""]}},
                    parent: null,
                    children: [],
                },
            },
            current_node: "a",
        };
        expect(() => parseChatGptConversation(convo as never)).toThrow(
            ChatImportParseError,
        );
    });

    it("falls back to a leaf when current_node is missing", () => {
        const convo = buildConvo() as {current_node?: string};
        delete convo.current_node;
        const result = parseChatGptConversation(convo as never);
        expect(result.messages.length).toBeGreaterThan(0);
    });

    it("handles cycles defensively (no infinite loop)", () => {
        const convo = {
            mapping: {
                a: {
                    id: "a",
                    message: {author: {role: "user"}, content: {parts: ["A"]}},
                    parent: "b",
                    children: [],
                },
                b: {
                    id: "b",
                    message: {author: {role: "assistant"}, content: {parts: ["B"]}},
                    parent: "a",
                    children: [],
                },
            },
            current_node: "a",
        };
        const result = parseChatGptConversation(convo as never);
        expect(result.messages.length).toBeLessThanOrEqual(2);
    });
});

describe("parseChatGptExport", () => {
    it("parses an array of conversations", () => {
        const result = parseChatGptExport([buildConvo(), buildConvo()]);
        expect(result.conversations.length).toBe(2);
        expect(result.warnings).toEqual([]);
    });

    it("collects warnings for malformed entries", () => {
        const result = parseChatGptExport([buildConvo(), {}]);
        expect(result.conversations.length).toBe(1);
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toContain("#2");
    });

    it("accepts envelope shape {conversations: [...]}", () => {
        const result = parseChatGptExport({conversations: [buildConvo()]});
        expect(result.conversations.length).toBe(1);
    });

    it("throws when the input is not an array or envelope", () => {
        expect(() => parseChatGptExport("not json" as never)).toThrow(
            ChatImportParseError,
        );
    });
});

describe("isChatGptExport", () => {
    it("recognises an array of mapping-shaped conversations", () => {
        expect(isChatGptExport([buildConvo()])).toBe(true);
    });

    it("recognises a single mapping-shaped conversation", () => {
        expect(isChatGptExport(buildConvo())).toBe(true);
    });

    it("recognises the envelope shape", () => {
        expect(isChatGptExport({conversations: [buildConvo()]})).toBe(true);
    });

    it("rejects unrelated shapes", () => {
        expect(isChatGptExport({chat_messages: []})).toBe(false);
        expect(isChatGptExport([])).toBe(false);
        expect(isChatGptExport(null)).toBe(false);
    });
});
