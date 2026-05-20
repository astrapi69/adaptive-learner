/**
 * Chat-import dispatcher tests (Phase 12A).
 */

import {describe, it, expect} from "vitest";
import {detectFormat, parseChatImport, totalMessageCount} from "./index";
import {ChatImportParseError} from "./types";

const chatGptSample = JSON.stringify([
    {
        title: "Sample",
        mapping: {
            a: {
                id: "a",
                message: {
                    author: {role: "user"},
                    content: {parts: ["Hi"]},
                },
                parent: null,
                children: [],
            },
        },
        current_node: "a",
    },
]);

const claudeSample = JSON.stringify({
    name: "Claude convo",
    chat_messages: [
        {sender: "human", text: "Q"},
        {sender: "assistant", text: "A"},
    ],
});

const genericSample = JSON.stringify({
    messages: [
        {role: "user", content: "Hello"},
        {role: "assistant", content: "Hi"},
    ],
});

const markdownSample = `**You:** What is X?\n\n**Assistant:** X is...`;

describe("detectFormat", () => {
    it("identifies ChatGPT JSON", () => {
        expect(detectFormat(chatGptSample)).toBe("chatgpt");
    });

    it("identifies Claude JSON", () => {
        expect(detectFormat(claudeSample)).toBe("claude");
    });

    it("identifies generic JSON envelope", () => {
        expect(detectFormat(genericSample)).toBe("generic");
    });

    it("falls back to markdown for plain text", () => {
        expect(detectFormat(markdownSample)).toBe("markdown");
    });

    it("returns unknown for empty input", () => {
        expect(detectFormat("")).toBe("unknown");
        expect(detectFormat("   ")).toBe("unknown");
    });
});

describe("parseChatImport (auto)", () => {
    it("dispatches to ChatGPT parser", () => {
        const result = parseChatImport(chatGptSample);
        expect(result.conversations[0]?.source).toBe("chatgpt");
    });

    it("dispatches to Claude parser", () => {
        const result = parseChatImport(claudeSample);
        expect(result.conversations[0]?.source).toBe("claude");
    });

    it("dispatches to generic parser", () => {
        const result = parseChatImport(genericSample);
        expect(result.conversations[0]?.source).toBe("unknown");
        expect(result.conversations[0]?.messages.length).toBe(2);
    });

    it("dispatches to markdown for plain paste", () => {
        const result = parseChatImport(markdownSample);
        expect(result.conversations[0]?.source).toBe("manual");
        expect(result.conversations[0]?.messages.length).toBe(2);
    });

    it("never throws on shapeless string input — falls back to markdown", () => {
        const result = parseChatImport("not json, no markers, just text");
        expect(result.conversations.length).toBe(1);
        expect(result.conversations[0]?.messages.length).toBe(1);
    });

    it("throws on empty input", () => {
        expect(() => parseChatImport("")).toThrow(ChatImportParseError);
    });
});

describe("parseChatImport (forced format)", () => {
    it("respects an explicit chatgpt format", () => {
        const result = parseChatImport(chatGptSample, {format: "chatgpt"});
        expect(result.conversations[0]?.source).toBe("chatgpt");
    });

    it("throws when forced chatgpt receives non-JSON", () => {
        expect(() =>
            parseChatImport("plain text", {format: "chatgpt"}),
        ).toThrow(ChatImportParseError);
    });

    it("respects explicit markdown format even on JSON-looking input", () => {
        const result = parseChatImport(
            "User: line one\nAssistant: line two",
            {format: "markdown"},
        );
        expect(result.conversations[0]?.messages.length).toBe(2);
    });
});

describe("totalMessageCount", () => {
    it("sums across conversations", () => {
        const result = parseChatImport(chatGptSample);
        expect(totalMessageCount(result)).toBe(1);
    });

    it("returns 0 on empty array", () => {
        expect(totalMessageCount({conversations: [], warnings: []})).toBe(0);
    });
});

describe("auto-detect single-conversation ChatGPT", () => {
    it("parses a non-array ChatGPT conversation", () => {
        const single = JSON.parse(chatGptSample)[0];
        const result = parseChatImport(JSON.stringify(single));
        expect(result.conversations.length).toBe(1);
        expect(result.conversations[0]?.source).toBe("chatgpt");
    });
});
