/**
 * Phase 33 audit suite — runs the dispatcher against the real
 * anonymized Claude.ai per-conversation Markdown export and
 * pins:
 *
 *   - 50 messages (25 user + 25 assistant)
 *   - per-turn timestamps preserved
 *   - source stamped as "claude"
 *   - dispatcher routes via the new claude_md_parser, NOT the
 *     generic markdown fallback
 *
 * BL-25 / BL-26 / BL-28 closed in the commit that ships
 * ``claude_md_parser.ts``; this file is the regression-pin
 * against any future regression.
 *
 * Run isolated:
 *   cd frontend && npx vitest run src/chat_import/claude_markdown_export.audit.test.ts
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

    it("BL-25 closed — auto-detect labels the file as 'claude'", () => {
        expect(detectFormat(FIXTURE_TEXT)).toBe("claude");
    });

    it("BL-25 closed — auto-detect produces 50 role-tagged messages", () => {
        const res = parseChatImport(FIXTURE_TEXT);
        expect(res.conversations).toHaveLength(1);
        const conv = res.conversations[0];
        expect(conv.source).toBe("claude");
        expect(conv.title).toBe("Grammatik mit adaptivem Lernprotokoll");
        expect(conv.messages).toHaveLength(50);
        const userCount = conv.messages.filter((m) => m.role === "user").length;
        const assistantCount = conv.messages.filter(
            (m) => m.role === "assistant",
        ).length;
        expect(userCount).toBe(25);
        expect(assistantCount).toBe(25);
        // Strict alternation, user first.
        for (let i = 0; i < conv.messages.length; i++) {
            expect(conv.messages[i].role).toBe(i % 2 === 0 ? "user" : "assistant");
        }
    });

    it("BL-25 closed — every turn carries an ISO-8601 timestamp", () => {
        const res = parseChatImport(FIXTURE_TEXT);
        const conv = res.conversations[0];
        for (const msg of conv.messages) {
            expect(msg.timestamp).toBeDefined();
            // ``YYYY-MM-DDTHH:MM:SS`` local-naive (no Z, no offset).
            expect(msg.timestamp).toMatch(
                /^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
            );
        }
        // First user message should be the very first ## Prompt:
        // timestamp from the source: 23.3.2026, 08:53:41.
        expect(conv.messages[0].timestamp).toBe("2026-03-23T08:53:41");
        // Timestamps must be monotonically non-decreasing across
        // the conversation (the real export is sorted).
        for (let i = 1; i < conv.messages.length; i++) {
            const prev = conv.messages[i - 1].timestamp!;
            const cur = conv.messages[i].timestamp!;
            expect(cur.localeCompare(prev) >= 0).toBe(true);
        }
    });

    it("BL-25 closed — metadata.created_at is preserved from the **Created:** line", () => {
        const res = parseChatImport(FIXTURE_TEXT);
        expect(res.conversations[0].metadata.created_at).toBe(
            "3/23/2026 8:53:40",
        );
    });

    it("BL-25 closed — first user message body is the actual first prompt, NOT the H1+metadata block", () => {
        const res = parseChatImport(FIXTURE_TEXT);
        const firstUser = res.conversations[0].messages[0];
        expect(firstUser.content).not.toContain("**Created:**");
        expect(firstUser.content).not.toContain("**Link:**");
        expect(firstUser.content).not.toContain("# Grammatik mit");
        expect(firstUser.content).toContain("Grammatikkenntnisse auffrischen");
    });

    it("BL-25 closed — assistant bodies preserve their internal ## headings", () => {
        const res = parseChatImport(FIXTURE_TEXT);
        const conv = res.conversations[0];
        // The second assistant response (index 3) in the real
        // fixture starts with the ``## Dein optimales Lernprofil``
        // internal heading; it must survive as part of the body.
        const secondAssistant = conv.messages[3];
        expect(secondAssistant.role).toBe("assistant");
        expect(secondAssistant.content).toContain(
            "## Dein optimales Lernprofil",
        );
    });

    it("BL-25 closed — assistant bodies preserve their plaintext thought-process fences", () => {
        const res = parseChatImport(FIXTURE_TEXT);
        const conv = res.conversations[0];
        // The first assistant response contains a ``Thought
        // process`` plaintext-fenced block that must be carried
        // through to the analyzer.
        const firstAssistant = conv.messages[1];
        expect(firstAssistant.content).toContain("Thought process");
        expect(firstAssistant.content).toContain("```");
    });

    it("forced 'claude-md' matches the auto-detect outcome (same parser, same shape)", () => {
        const auto = parseChatImport(FIXTURE_TEXT);
        const forced = parseChatImport(FIXTURE_TEXT, {format: "claude-md"});
        expect(forced.conversations[0].source).toBe("claude");
        expect(forced.conversations[0].messages.length).toBe(
            auto.conversations[0].messages.length,
        );
    });

    it("forced 'claude' (JSON-only) still rejects the .md input — back-compat preserved", () => {
        // The existing JSON Claude parser must NOT silently accept
        // the .md shape. The new path is gated behind the new
        // ``claude-md`` value so existing callers see no change.
        expect(() => parseChatImport(FIXTURE_TEXT, {format: "claude"})).toThrowError(
            ChatImportParseError,
        );
    });

    it("forced 'markdown' still produces the legacy fallback (one user message) — markdown_parser semantics untouched", () => {
        // The generic markdown_parser is unchanged. Users who
        // explicitly force ``format: "markdown"`` on a Claude .md
        // file get the old swallow-everything behaviour — which is
        // the right call for a parser that handles free-form
        // pastes from any source. Auto-detect routes to the
        // dedicated parser before the fallback fires.
        const res = parseChatImport(FIXTURE_TEXT, {format: "markdown"});
        expect(res.conversations).toHaveLength(1);
        expect(res.conversations[0].source).toBe("manual");
        expect(res.conversations[0].messages).toHaveLength(1);
    });
});

describe("A6 edge cases — parser behaviour pins (generic markdown_parser)", () => {
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
        const conv = res.conversations[0];
        expect(conv.messages).toHaveLength(1);
        expect(conv.messages[0].role).toBe("user");
        expect(conv.messages[0].content).toBe(blob);
    });
});
