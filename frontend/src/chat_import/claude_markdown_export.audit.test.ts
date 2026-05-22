/**
 * Phase 33 A1 / A6 — Parser audit against the real anonymized
 * Claude.ai per-conversation Markdown export, plus the A6 edge
 * cases (empty, user-only, large, mixed-language, code blocks,
 * non-chat JSON).
 *
 * The audit pins the CURRENT behaviour. Where the current
 * behaviour is wrong (silent under-parsing of Claude.ai Markdown
 * exports), the test name carries ``regression-pin`` and a
 * pointer to the backlog item that tracks the fix.
 *
 * Run isolated: ``cd frontend && npx vitest run src/chat_import/claude_markdown_export.audit.test.ts``
 */

import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import {detectFormat, parseChatImport, ChatImportParseError} from "./index";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "__fixtures__/claude-markdown-export.md");
const FIXTURE_TEXT = readFileSync(FIXTURE, "utf-8");

describe("Claude.ai per-conversation Markdown export — real fixture", () => {
    it("file shape is what the audit assumes (50 turns, ~73KB)", () => {
        const promptCount = (FIXTURE_TEXT.match(/^## Prompt:$/gm) ?? []).length;
        const responseCount = (FIXTURE_TEXT.match(/^## Response:$/gm) ?? []).length;
        expect(promptCount).toBe(25);
        expect(responseCount).toBe(25);
        expect(FIXTURE_TEXT.length).toBeGreaterThan(70_000);
        expect(FIXTURE_TEXT.length).toBeLessThan(80_000);
    });

    it("auto-detect routes to markdown (Claude.ai .md is NOT the JSON bulk export)", () => {
        expect(detectFormat(FIXTURE_TEXT)).toBe("markdown");
    });

    it("regression-pin BL-25 — auto-detect collapses to a single user message", () => {
        // EXPECTED-FUTURE-BEHAVIOUR: 25 user + 25 assistant messages
        // with timestamps preserved. CURRENT-BEHAVIOUR: 1 user message
        // of the entire file. Bumping the assertion (e.g. expecting 50
        // messages) is the green-light that BL-25 has shipped — when
        // that happens, flip this test to assert the right shape and
        // delete the regression-pin label.
        const res = parseChatImport(FIXTURE_TEXT);
        expect(res.conversations).toHaveLength(1);
        const conv = res.conversations[0];
        expect(conv.source).toBe("manual");
        expect(conv.messages).toHaveLength(1);
        expect(conv.messages[0].role).toBe("user");
        expect(conv.messages[0].content.length).toBe(FIXTURE_TEXT.trim().length);
        // No timestamps survive the swallow-everything fallback.
        expect(conv.messages[0].timestamp).toBeUndefined();
        // The title IS correctly derived from the H1.
        expect(conv.title).toBe("Grammatik mit adaptivem Lernprotokoll");
    });

    it("forced markdown matches the auto-detect outcome (same fallback path)", () => {
        const auto = parseChatImport(FIXTURE_TEXT);
        const forced = parseChatImport(FIXTURE_TEXT, {format: "markdown"});
        expect(forced.conversations).toHaveLength(auto.conversations.length);
        expect(forced.conversations[0].messages.length).toBe(
            auto.conversations[0].messages.length,
        );
    });

    it("forced claude / chatgpt / generic reject non-JSON with a clear error", () => {
        for (const format of ["claude", "chatgpt", "generic"] as const) {
            expect(() => parseChatImport(FIXTURE_TEXT, {format})).toThrowError(
                ChatImportParseError,
            );
        }
    });
});

describe("A6 edge cases — parser behaviour pins", () => {
    it("empty input throws ChatImportParseError, NOT a silent empty result", () => {
        expect(() => parseChatImport("")).toThrowError(ChatImportParseError);
        expect(() => parseChatImport("   \n  \n")).toThrowError(ChatImportParseError);
    });

    it("user-only shape (no assistant turns) yields user messages only", () => {
        const blob = `**You:** first\n\n**You:** second\n\n**You:** third\n`;
        const res = parseChatImport(blob);
        const msgs = res.conversations[0].messages;
        expect(msgs).toHaveLength(3);
        expect(msgs.every((m) => m.role === "user")).toBe(true);
        expect(msgs.map((m) => m.content)).toEqual(["first", "second", "third"]);
    });

    it("large input (1000 alternating turns) parses without timeout / overflow", () => {
        const turns: string[] = [];
        for (let i = 0; i < 500; i++) {
            turns.push(`**You:** message ${i}`);
            turns.push(`**Assistant:** reply ${i}`);
        }
        const blob = turns.join("\n\n");
        const res = parseChatImport(blob);
        expect(res.conversations[0].messages).toHaveLength(1000);
        const userCount = res.conversations[0].messages.filter(
            (m) => m.role === "user",
        ).length;
        expect(userCount).toBe(500);
    });

    it("mixed-language markers (German user markers) parse correctly", () => {
        const blob = [
            "**Ich:** Wie funktioniert das?",
            "",
            "**KI:** So funktioniert es.",
            "",
            "**Frage:** Und das hier?",
            "",
            "**Antwort:** Genau so.",
        ].join("\n");
        const res = parseChatImport(blob);
        const msgs = res.conversations[0].messages;
        expect(msgs).toHaveLength(4);
        expect(msgs.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "user",
            "assistant",
        ]);
    });

    it("code blocks (```python ... ```) are preserved verbatim in message content", () => {
        const blob = [
            "**You:** Look at this:",
            "```python",
            "def hi():",
            "    return 'hello'",
            "```",
            "",
            "**Assistant:** Yes, that prints hello.",
        ].join("\n");
        const res = parseChatImport(blob);
        const msgs = res.conversations[0].messages;
        expect(msgs).toHaveLength(2);
        expect(msgs[0].content).toContain("```python");
        expect(msgs[0].content).toContain("def hi():");
        expect(msgs[0].content).toContain("```");
    });

    it("non-chat random JSON falls back to markdown fallback (single user message)", () => {
        const blob = '{"some": "unrelated", "shape": [1, 2, 3]}';
        const res = parseChatImport(blob);
        // tryParseJson succeeds; none of the sniffs match; the
        // dispatcher then routes back to markdown.
        const conv = res.conversations[0];
        expect(conv.messages).toHaveLength(1);
        expect(conv.messages[0].role).toBe("user");
        expect(conv.messages[0].content).toBe(blob);
    });

    it("regression-pin BL-26 — Claude.ai 'Prompt:' / 'Response:' headers are not recognized", () => {
        // The Claude.ai per-conversation Markdown export uses
        // ``## Prompt:`` and ``## Response:`` as role markers. Both
        // are stripped of trailing colons by the parser
        // (recogniseMarker -> headingMatch branch), then classified
        // against USER_MARKERS / ASSISTANT_MARKERS — and "prompt" +
        // "response" are not in either list. So a minimal Claude.ai
        // export shape collapses to one big user message.
        //
        // EXPECTED-FUTURE-BEHAVIOUR: prompt -> user, response ->
        // assistant. Fixing the markdown_parser's classifyName
        // allowlist closes BL-25 (the full-fixture symptom) and
        // BL-26 (this minimal shape).
        const minimal = [
            "## Prompt:",
            "Hello, how are you?",
            "",
            "## Response:",
            "I am fine, thanks.",
        ].join("\n");
        const res = parseChatImport(minimal);
        expect(res.conversations[0].messages).toHaveLength(1);
        expect(res.conversations[0].messages[0].role).toBe("user");
    });
});
