/**
 * Markdown / plain-text parser tests (Phase 12A).
 */

import {describe, it, expect} from "vitest";
import {parseMarkdownConversation} from "./markdown_parser";
import {ChatImportParseError} from "./types";

describe("parseMarkdownConversation", () => {
    it("splits on **You:** / **Assistant:** markers", () => {
        const raw = `**You:** What is induction?

**Assistant:** Induction generalises from examples.

**You:** Give me one.

**Assistant:** Every swan I've seen is white...`;
        const result = parseMarkdownConversation(raw);
        expect(result.source).toBe("manual");
        expect(result.messages.length).toBe(4);
        expect(result.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "user",
            "assistant",
        ]);
        expect(result.messages[0]?.content).toBe("What is induction?");
    });

    it("splits on plain Name: markers", () => {
        const raw = `User: Hello.
Assistant: Hi there.
User: How are you?
Assistant: Doing well.`;
        const result = parseMarkdownConversation(raw);
        expect(result.messages.length).toBe(4);
        expect(result.messages[0]?.role).toBe("user");
    });

    it("recognises Human/Claude markers", () => {
        const raw = `Human: Are you Claude?\nClaude: Yes I am.`;
        const result = parseMarkdownConversation(raw);
        expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    });

    it("recognises markdown heading markers", () => {
        const raw = `## You\nFirst question.\n## Assistant\nFirst answer.`;
        const result = parseMarkdownConversation(raw);
        expect(result.messages.length).toBe(2);
        expect(result.messages[0]?.content).toBe("First question.");
    });

    it("uses first user message as title fallback", () => {
        const raw = `You: Teach me about Bayes theorem`;
        const result = parseMarkdownConversation(raw);
        expect(result.title).toBe("Teach me about Bayes theorem");
    });

    it("truncates long title to 80 chars", () => {
        const veryLong = "a".repeat(200);
        const result = parseMarkdownConversation(`You: ${veryLong}`);
        expect(result.title.length).toBeLessThanOrEqual(80);
        expect(result.title.endsWith("…")).toBe(true);
    });

    it("derives title from first markdown heading", () => {
        const raw = `# My Learning Journal\n\nSome content with no markers at all.`;
        const result = parseMarkdownConversation(raw);
        expect(result.title).toBe("My Learning Journal");
    });

    it("falls back to a single user message when no markers match", () => {
        const raw = "Just some pasted text with no role markers at all.";
        const result = parseMarkdownConversation(raw);
        expect(result.messages.length).toBe(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.content).toBe(raw);
    });

    it("handles bold markers with separate colon", () => {
        const raw = `**You**: Hello\n**Assistant**: Hi`;
        const result = parseMarkdownConversation(raw);
        expect(result.messages.length).toBe(2);
        expect(result.messages[0]?.content).toBe("Hello");
    });

    it("supports German role markers", () => {
        const raw = `Frage: Was ist Bayes?\nAntwort: Ein Satz der Wahrscheinlichkeit.`;
        const result = parseMarkdownConversation(raw);
        expect(result.messages.length).toBe(2);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[1]?.role).toBe("assistant");
    });

    it("respects explicit title override", () => {
        const result = parseMarkdownConversation("You: Hi", {title: "Override"});
        expect(result.title).toBe("Override");
    });

    it("throws on empty input", () => {
        expect(() => parseMarkdownConversation("")).toThrow(ChatImportParseError);
        expect(() => parseMarkdownConversation("   \n  ")).toThrow(
            ChatImportParseError,
        );
    });

    it("preserves multi-line message body", () => {
        const raw = `You: Question.\n\nMore detail.\n\nAssistant: Answer.`;
        const result = parseMarkdownConversation(raw);
        expect(result.messages[0]?.content).toBe("Question.\n\nMore detail.");
    });
});
