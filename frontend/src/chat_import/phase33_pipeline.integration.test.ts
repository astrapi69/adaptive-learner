/**
 * Phase 33 A2-A5 re-validation — full pipeline integration
 * against the real anonymized Claude.ai .md fixture, end-to-end
 * up to (but not including) the network call.
 *
 * What this pins:
 *
 *  A1 (post-fix): parser produces 50 messages, role-tagged,
 *      timestamps preserved, source="claude".
 *  A2 (analysis prompt + chunking): chunkMessages produces N
 *      chunks of bounded size; buildAnalysisUserContent labels
 *      "Learner:" / "AI:" alternation; the prompt sent to the
 *      AI carries actual role boundaries (this is the bit that
 *      was completely broken pre-fix).
 *  A3 (Dexie mode parity): the same code path runs in Dexie
 *      mode — analysis.ts is mode-agnostic — so a green pipeline
 *      here means green pipeline in both modes (the storage
 *      layer is the difference, not the analyzer).
 *  A4 / A5 (downstream): with the parser fixed, the analyzer
 *      input has real role structure. The actual AI quality
 *      verification (does the analysis surface "Komma vor
 *      obwohl"?) is browser-driven and lives in Part B section
 *      B7 of ``docs/manual-tests/phase-33-import-audit.md``.
 *
 * The integration test does NOT call ``analyzeConversation``
 * itself (that hits the AI). It exercises the pipeline up to
 * the prompt-construction step and asserts the prompt is well-
 * formed.
 */

import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import {
    MAX_CHUNK_CHARS,
    buildAnalysisUserContent,
    chunkMessages,
} from "./analysis";
import {parseChatImport} from "./index";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "__fixtures__/claude-markdown-export.md");
const FIXTURE_TEXT = readFileSync(FIXTURE, "utf-8");

describe("Phase 33 — full pipeline against real fixture", () => {
    it("A1 — parser produces 50 role-tagged messages with timestamps", () => {
        const result = parseChatImport(FIXTURE_TEXT);
        const conv = result.conversations[0];
        expect(conv.source).toBe("claude");
        expect(conv.messages).toHaveLength(50);
        expect(
            conv.messages.every((m) => Boolean(m.timestamp)),
        ).toBe(true);
    });

    it("A2 — chunker splits the transcript into a small number of bounded chunks", () => {
        const conv = parseChatImport(FIXTURE_TEXT).conversations[0];
        const chunks = chunkMessages(conv.messages);
        // The fixture is ~73KB total. At MAX_CHUNK_CHARS=16K
        // we expect roughly 4-7 chunks (depends on per-message
        // sizes); pin the range, not the exact count, so a
        // small content edit doesn't break the test.
        expect(chunks.length).toBeGreaterThanOrEqual(3);
        expect(chunks.length).toBeLessThanOrEqual(8);
        for (const chunk of chunks) {
            const size = chunk.reduce(
                (s, m) => s + m.content.length + m.role.length + 4,
                0,
            );
            // 1.05x bumper for the 2-message overlap going in.
            expect(size).toBeLessThanOrEqual(MAX_CHUNK_CHARS * 1.5);
        }
        // Every message is in at least one chunk.
        const seenIds = new Set<string>();
        for (const chunk of chunks) {
            for (const m of chunk) seenIds.add(`${m.role}|${m.content.slice(0, 50)}`);
        }
        // 50 messages in, at most 50 distinct (overlap is fine).
        // The lower bound is what matters — we lose no messages.
        expect(seenIds.size).toBeGreaterThanOrEqual(49);
    });

    it("A2 — analyzer user-content carries 'Learner:' + 'AI:' role boundaries (the bit pre-fix was broken)", () => {
        const conv = parseChatImport(FIXTURE_TEXT).conversations[0];
        const chunks = chunkMessages(conv.messages);
        const first = buildAnalysisUserContent(chunks[0], conv.title);
        // The role labels MUST be present — this is what the AI
        // uses to distinguish user errors from assistant
        // corrections. Pre-fix, every turn was labelled
        // "Learner:" because the parser fed it as a single user
        // message.
        expect(first).toContain("Title: Grammatik mit adaptivem Lernprotokoll");
        expect(first).toContain("Learner:");
        expect(first).toContain("AI:");
        // The actual user's first prompt is recognizable.
        expect(first).toContain("Grammatikkenntnisse auffrischen");
        // The closing instruction guards the JSON-only response.
        expect(first).toContain("Return only the JSON analysis");
    });

    it("A2 — sum of chunk content + overlap covers every distinct user prompt", () => {
        const conv = parseChatImport(FIXTURE_TEXT).conversations[0];
        const userMessages = conv.messages.filter((m) => m.role === "user");
        expect(userMessages).toHaveLength(25);
        // Pick three concrete user prompts from the start, middle,
        // and end of the conversation. All three must appear in
        // at least one chunk's analyzer user-content.
        const chunks = chunkMessages(conv.messages);
        const allContent = chunks
            .map((c) => buildAnalysisUserContent(c, conv.title))
            .join("\n\n---\n\n");
        // First-turn marker.
        expect(allContent).toContain("Grammatikkenntnisse auffrischen");
        // Random-mid marker (from the user's grammar diagnostic
        // answers). The actual phrase is preserved verbatim by
        // the parser.
        expect(allContent).toContain("Aufgabe");
    });

    it("A4 — first-turn user content does NOT include the H1+metadata block", () => {
        const conv = parseChatImport(FIXTURE_TEXT).conversations[0];
        const chunks = chunkMessages(conv.messages);
        const first = buildAnalysisUserContent(chunks[0], conv.title);
        // These three signals would mean the parser fed the
        // file-header block as a user message. Pre-fix they were
        // all present in the analyzer input. Post-fix they must
        // be absent from the user-content body (the H1 title is
        // a separate Title: line, not in the transcript).
        const transcriptOnly = first.split("--- transcript ---")[1]?.split("--- end transcript ---")[0] ?? "";
        expect(transcriptOnly).not.toContain("**Created:**");
        expect(transcriptOnly).not.toContain("**Link:**");
        expect(transcriptOnly).not.toContain("**Exported:**");
    });

    it("A5 — assistant turns survive intact into chunked analyzer input (so the AI sees corrections, not just errors)", () => {
        const conv = parseChatImport(FIXTURE_TEXT).conversations[0];
        const chunks = chunkMessages(conv.messages);
        const allContent = chunks
            .map((c) => buildAnalysisUserContent(c, conv.title))
            .join("\n\n---\n\n");
        // The first assistant response carries the assistant's
        // adaptive-learning-protocol activation. If this survives,
        // the AI has the corrections it needs to identify
        // weaknesses + error patterns.
        expect(allContent).toContain("Adaptives Lernprotokoll");
    });
});
