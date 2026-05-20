/**
 * Generic JSON parser tests (Phase 12A).
 */

import {describe, it, expect} from "vitest";
import {isGenericJsonShape, parseGenericJson} from "./generic_parser";
import {ChatImportParseError} from "./types";

describe("parseGenericJson", () => {
    it("parses {messages: [...]} envelope", () => {
        const result = parseGenericJson({
            title: "Demo",
            model: "gpt-4o-mini",
            messages: [
                {role: "user", content: "Hello"},
                {role: "assistant", content: "Hi there"},
            ],
        });
        expect(result.source).toBe("unknown");
        expect(result.title).toBe("Demo");
        expect(result.metadata.model).toBe("gpt-4o-mini");
        expect(result.messages.length).toBe(2);
    });

    it("parses bare array shape", () => {
        const result = parseGenericJson([
            {role: "user", content: "A"},
            {role: "assistant", content: "B"},
        ]);
        expect(result.messages.length).toBe(2);
        expect(result.title).toBe("A");
    });

    it("normalises human/claude/model role aliases", () => {
        const result = parseGenericJson([
            {role: "human", content: "Hi"},
            {role: "model", content: "Hello"},
            {role: "claude", content: "Hi again"},
            {role: "ai", content: "Yep"},
        ]);
        expect(result.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "assistant",
            "assistant",
        ]);
    });

    it("accepts sender alias and text alias", () => {
        const result = parseGenericJson([{sender: "user", text: "Hi via sender"}]);
        expect(result.messages.length).toBe(1);
        expect(result.messages[0]?.content).toBe("Hi via sender");
    });

    it("carries timestamps when present", () => {
        const result = parseGenericJson([
            {role: "user", content: "Q", timestamp: "2025-02-01T10:00:00Z"},
            {role: "assistant", content: "A", created_at: "2025-02-01T10:00:10Z"},
        ]);
        expect(result.messages[0]?.timestamp).toBe("2025-02-01T10:00:00Z");
        expect(result.messages[1]?.timestamp).toBe("2025-02-01T10:00:10Z");
    });

    it("matches known source on envelope.source", () => {
        const result = parseGenericJson({
            source: "gemini",
            messages: [{role: "user", content: "Hi"}],
        });
        expect(result.source).toBe("gemini");
    });

    it("rejects messages with no parseable content", () => {
        expect(() =>
            parseGenericJson({messages: [{role: "user", content: ""}]}),
        ).toThrow(ChatImportParseError);
    });

    it("rejects bare-array with no parseable messages", () => {
        expect(() => parseGenericJson([])).toThrow(ChatImportParseError);
    });

    it("rejects unrecognisable input shape", () => {
        expect(() => parseGenericJson({foo: "bar"})).toThrow(ChatImportParseError);
    });
});

describe("isGenericJsonShape", () => {
    it("recognises envelope shape", () => {
        expect(isGenericJsonShape({messages: []})).toBe(true);
    });

    it("recognises bare array of message-like objects", () => {
        expect(isGenericJsonShape([{role: "user", content: "x"}])).toBe(true);
    });

    it("recognises sender/text aliases", () => {
        expect(isGenericJsonShape([{sender: "user", text: "x"}])).toBe(true);
    });

    it("rejects ChatGPT-shaped objects", () => {
        // ChatGPT shape doesn't have role/sender on the top-level
        // mapping key, so it stays distinguishable.
        expect(isGenericJsonShape({mapping: {}, current_node: "x"})).toBe(false);
    });
});
