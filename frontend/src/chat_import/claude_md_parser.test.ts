/**
 * Unit tests for the Claude.ai per-conversation Markdown
 * export parser (BL-25 / BL-26 / BL-28 closure).
 *
 * The audit suite in ``claude_markdown_export.audit.test.ts``
 * exercises the parser against the real anonymized fixture
 * end-to-end. These tests target each piece of the parser
 * directly with small focused inputs so a regression points
 * at the right spot.
 */

import {describe, expect, it} from "vitest";

import {
    isClaudeMarkdownExport,
    normaliseMetadataDate,
    parseClaudeMarkdownExport,
} from "./claude_md_parser";
import {ChatImportParseError} from "./types";

/** Helper — assemble a minimal Claude .md export. */
function build(opts: {
    title?: string;
    metadata?: string;
    turns: Array<{role: "user" | "assistant"; timestamp?: string; body: string}>;
}): string {
    const head = [
        `# ${opts.title ?? "Test conversation"}`,
        "",
        opts.metadata ??
            [
                "**Created:** 3/23/2026 8:53:40  ",
                "**Updated:** 4/22/2026 9:55:53  ",
                "**Exported:** 5/20/2026 10:58:47  ",
                "**Link:** [https://claude.ai/chat/00000000-0000-0000-0000-000000000000](https://claude.ai/chat/00000000-0000-0000-0000-000000000000)  ",
            ].join("\n"),
        "",
    ].join("\n");
    const body = opts.turns
        .map((t) => {
            const header = t.role === "user" ? "## Prompt:" : "## Response:";
            const ts = t.timestamp ? `${t.timestamp}\n\n` : "";
            return `${header}\n${ts}${t.body}\n`;
        })
        .join("\n");
    return `${head}\n${body}`;
}

describe("isClaudeMarkdownExport", () => {
    it("recognizes a minimal Claude .md export", () => {
        const raw = build({turns: [{role: "user", body: "hi"}]});
        expect(isClaudeMarkdownExport(raw)).toBe(true);
    });

    it("rejects non-string input", () => {
        expect(isClaudeMarkdownExport({})).toBe(false);
        expect(isClaudeMarkdownExport(null)).toBe(false);
        expect(isClaudeMarkdownExport(42)).toBe(false);
    });

    it("rejects too-short input", () => {
        expect(isClaudeMarkdownExport("# Hi")).toBe(false);
    });

    it("rejects when no H1 is present", () => {
        const raw = [
            "**Link:** [https://claude.ai/chat/abc](https://claude.ai/chat/abc)",
            "",
            "## Prompt:",
            "23.3.2026, 08:53:41",
            "",
            "hi",
        ].join("\n");
        expect(isClaudeMarkdownExport(raw)).toBe(false);
    });

    it("rejects when no claude.ai link is present", () => {
        const raw = [
            "# Title",
            "",
            "**Created:** 3/23/2026 8:53:40  ",
            "",
            "## Prompt:",
            "hi",
        ].join("\n");
        expect(isClaudeMarkdownExport(raw)).toBe(false);
    });

    it("rejects when no ## Prompt: boundary is present (orphan metadata)", () => {
        const raw = [
            "# Title",
            "",
            "**Link:** [https://claude.ai/chat/abc](https://claude.ai/chat/abc)  ",
            "",
            "Just some prose, no boundaries.",
        ].join("\n");
        expect(isClaudeMarkdownExport(raw)).toBe(false);
    });

    it("accepts an export that uses bare URL syntax (no markdown-link)", () => {
        const raw = [
            "# Title",
            "",
            "**Link:** https://claude.ai/chat/00000000-0000-0000-0000-000000000000",
            "",
            "## Prompt:",
            "hi",
        ].join("\n");
        expect(isClaudeMarkdownExport(raw)).toBe(true);
    });
});

describe("parseClaudeMarkdownExport — turn boundaries", () => {
    it("alternating user/assistant turns map to user/assistant roles", () => {
        const raw = build({
            turns: [
                {role: "user", timestamp: "23.3.2026, 08:53:41", body: "Hello"},
                {role: "assistant", timestamp: "23.3.2026, 08:53:57", body: "Hi"},
                {role: "user", timestamp: "23.3.2026, 08:54:00", body: "Question"},
                {role: "assistant", timestamp: "23.3.2026, 08:54:30", body: "Answer"},
            ],
        });
        const result = parseClaudeMarkdownExport(raw);
        expect(result.source).toBe("claude");
        expect(result.messages).toHaveLength(4);
        expect(result.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "user",
            "assistant",
        ]);
        expect(result.messages.map((m) => m.content)).toEqual([
            "Hello",
            "Hi",
            "Question",
            "Answer",
        ]);
    });

    it("internal ## headings inside a response body do NOT split the turn (BL-25 root cause)", () => {
        // The exact failure shape the v1.19 markdown_parser hit:
        // assistant emits its own H2 headings as section dividers
        // INSIDE the reply, and those must stay in the body.
        const raw = build({
            turns: [
                {role: "user", timestamp: "23.3.2026, 09:00:00", body: "Diagnose me."},
                {
                    role: "assistant",
                    timestamp: "23.3.2026, 09:00:30",
                    body: [
                        "## Dein optimales Lernprofil",
                        "",
                        "**Was funktioniert:**",
                        "1. Drill",
                        "",
                        "## Diagnose-Runde: Wo stehst du?",
                        "",
                        "**Aufgabe 1:** Setze die Kommas.",
                    ].join("\n"),
                },
            ],
        });
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages).toHaveLength(2);
        expect(result.messages[1].role).toBe("assistant");
        expect(result.messages[1].content).toContain("Dein optimales Lernprofil");
        expect(result.messages[1].content).toContain("Diagnose-Runde");
        expect(result.messages[1].content).toContain("Aufgabe 1");
    });

    it("code-fenced ```plaintext tool/thought blocks stay inside the response body", () => {
        const responseBody = [
            "````plaintext",
            "Thought process: Synthesizing answer.",
            "",
            "The user wants X.",
            "````",
            "",
            "````plaintext",
            "Tool: Looking for relevant chats...",
            "````",
            "",
            "Here is my answer.",
        ].join("\n");
        const raw = build({
            turns: [
                {role: "user", timestamp: "23.3.2026, 09:00:00", body: "Help"},
                {role: "assistant", timestamp: "23.3.2026, 09:00:30", body: responseBody},
            ],
        });
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages).toHaveLength(2);
        expect(result.messages[1].content).toContain("Thought process");
        expect(result.messages[1].content).toContain("Tool: Looking");
        expect(result.messages[1].content).toContain("Here is my answer");
    });

    it("user messages with embedded ## headings preserve them (unusual but possible)", () => {
        const raw = build({
            turns: [
                {
                    role: "user",
                    timestamp: "23.3.2026, 09:00:00",
                    body: [
                        "Question with my own structure:",
                        "",
                        "## Section A",
                        "thing 1",
                        "",
                        "## Section B",
                        "thing 2",
                    ].join("\n"),
                },
            ],
        });
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[0].content).toContain("## Section A");
        expect(result.messages[0].content).toContain("## Section B");
    });
});

describe("parseClaudeMarkdownExport — timestamp extraction", () => {
    it("normalizes D.M.YYYY, HH:MM:SS to ISO 8601 local-naive", () => {
        const raw = build({
            turns: [
                {role: "user", timestamp: "23.3.2026, 08:53:41", body: "Hi"},
                {role: "assistant", timestamp: "1.12.2026, 9:05:00", body: "Hello"},
            ],
        });
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages[0].timestamp).toBe("2026-03-23T08:53:41");
        // Single-digit day + single-digit hour, both padded.
        expect(result.messages[1].timestamp).toBe("2026-12-01T09:05:00");
    });

    it("turn without a timestamp line still parses (graceful degradation)", () => {
        const raw = [
            "# Title",
            "",
            "**Link:** https://claude.ai/chat/abc",
            "",
            "## Prompt:",
            "",
            "No timestamp on this turn",
            "",
            "## Response:",
            "",
            "Same.",
        ].join("\n");
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].timestamp).toBeUndefined();
        expect(result.messages[0].content).toBe("No timestamp on this turn");
        expect(result.messages[1].timestamp).toBeUndefined();
    });

    it("garbage on the first line is NOT swallowed as a timestamp; stays in body", () => {
        const raw = [
            "# Title",
            "",
            "**Link:** https://claude.ai/chat/abc",
            "",
            "## Prompt:",
            "Not a timestamp at all.",
            "",
            "Question body.",
        ].join("\n");
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].timestamp).toBeUndefined();
        expect(result.messages[0].content).toContain("Not a timestamp at all");
        expect(result.messages[0].content).toContain("Question body");
    });
});

describe("parseClaudeMarkdownExport — metadata + title", () => {
    it("extracts the title from the H1", () => {
        const raw = build({title: "My Grammar Chat", turns: [{role: "user", body: "hi"}]});
        const result = parseClaudeMarkdownExport(raw);
        expect(result.title).toBe("My Grammar Chat");
    });

    it("normalises the Created: line in metadata.created_at to ISO-8601 (BL-29 — Pydantic-acceptable)", () => {
        const raw = build({turns: [{role: "user", body: "hi"}]});
        const result = parseClaudeMarkdownExport(raw);
        // Source: ``**Created:** 3/23/2026 8:53:40`` (US locale)
        // After normalisation: backend Pydantic ``datetime`` accepts.
        expect(result.metadata.created_at).toBe("2026-03-23T08:53:40");
    });

    it("the **Created:** block is NOT swallowed into the first message body", () => {
        const raw = build({turns: [{role: "user", body: "first user message"}]});
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages[0].content).toBe("first user message");
        expect(result.messages[0].content).not.toContain("**Created:**");
    });
});

describe("normaliseMetadataDate — BL-29 closure (Pydantic datetime needs ISO)", () => {
    it("US locale M/D/YYYY H:MM:SS -> ISO", () => {
        expect(normaliseMetadataDate("3/23/2026 8:53:40")).toBe(
            "2026-03-23T08:53:40",
        );
        // Two-digit month/day/hour also.
        expect(normaliseMetadataDate("11/29/2026 10:00:00")).toBe(
            "2026-11-29T10:00:00",
        );
    });

    it("DE locale D.M.YYYY HH:MM:SS -> ISO (with and without comma)", () => {
        expect(normaliseMetadataDate("23.3.2026 08:53:40")).toBe(
            "2026-03-23T08:53:40",
        );
        expect(normaliseMetadataDate("23.3.2026, 08:53:40")).toBe(
            "2026-03-23T08:53:40",
        );
        // Two-digit day + month.
        expect(normaliseMetadataDate("29.11.2026, 10:00:00")).toBe(
            "2026-11-29T10:00:00",
        );
    });

    it("ISO already pass through", () => {
        expect(normaliseMetadataDate("2026-03-23T08:53:40")).toBe(
            "2026-03-23T08:53:40",
        );
        // Space-separated ISO normalised to T.
        expect(normaliseMetadataDate("2026-03-23 08:53:40")).toBe(
            "2026-03-23T08:53:40",
        );
    });

    it("unrecognised shape returns undefined (caller drops the field)", () => {
        // Anything that doesn't match US, DE, or ISO is dropped
        // rather than passed through to break Pydantic.
        expect(normaliseMetadataDate("not a date")).toBeUndefined();
        expect(normaliseMetadataDate("")).toBeUndefined();
        expect(normaliseMetadataDate("   ")).toBeUndefined();
        expect(normaliseMetadataDate("23-3-2026 08:53:40")).toBeUndefined();
        expect(normaliseMetadataDate("Mar 23, 2026 8:53:40 AM")).toBeUndefined();
    });
});

describe("parseClaudeMarkdownExport — error paths", () => {
    it("throws ChatImportParseError on empty input", () => {
        expect(() => parseClaudeMarkdownExport("")).toThrowError(
            ChatImportParseError,
        );
        expect(() => parseClaudeMarkdownExport("    \n  \n")).toThrowError(
            ChatImportParseError,
        );
    });

    it("throws ChatImportParseError when there are no ## Prompt: / ## Response: boundaries", () => {
        const raw = [
            "# Random title",
            "",
            "**Link:** https://claude.ai/chat/abc",
            "",
            "Some prose but no boundaries.",
        ].join("\n");
        expect(() => parseClaudeMarkdownExport(raw)).toThrowError(
            ChatImportParseError,
        );
    });

    it("BL-26 minimal shape — bare ## Prompt: + ## Response: is parsed correctly", () => {
        // The minimal Claude.ai export structure. No top-of-file
        // metadata, no timestamps — just the two boundaries. The
        // parser must produce two role-tagged messages.
        const raw = [
            "# Title",
            "",
            "**Link:** https://claude.ai/chat/00000000-0000-0000-0000-000000000000",
            "",
            "## Prompt:",
            "Hello, how are you?",
            "",
            "## Response:",
            "I am fine, thanks.",
        ].join("\n");
        const result = parseClaudeMarkdownExport(raw);
        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[0].content).toBe("Hello, how are you?");
        expect(result.messages[1].role).toBe("assistant");
        expect(result.messages[1].content).toBe("I am fine, thanks.");
        expect(result.source).toBe("claude");
    });
});
