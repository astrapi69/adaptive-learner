/**
 * Analysis-engine tests (Phase 12D).
 *
 * Mocks ``aiComplete`` so the suite never hits the network.
 */

import {describe, it, expect, vi, beforeEach} from "vitest";
import {
    LANGUAGE_NAMES,
    analyzeConversation,
    buildAnalysisUserContent,
    buildSystemPrompt,
    chunkMessages,
    deterministicFallback,
    mergeAnalyses,
    parseAnalysisResponse,
} from "./analysis";
import type {NormalizedMessage} from "./types";

vi.mock("../storage/ai-providers", () => ({
    aiComplete: vi.fn(),
    resolveModel: vi.fn(() => "test-model"),
}));

import {aiComplete} from "../storage/ai-providers";

const mockedAiComplete = vi.mocked(aiComplete);

const validJson = JSON.stringify({
    topic: "Bayes theorem",
    subtopics: ["prior", "posterior"],
    user_level: "beginner",
    strengths: ["good question"],
    weaknesses: ["confused likelihood with posterior"],
    error_patterns: ["swap p(A|B) and p(B|A)"],
    recommended_method: "inductive",
    recommended_focus: "Work through 3 concrete examples.",
    suggested_curriculum: [
        {title: "L1", description: "Basics", priority: 1},
        {title: "L2", description: "Examples", priority: 2},
    ],
    summary: "Beginner grasping foundations of Bayes.",
});

describe("parseAnalysisResponse", () => {
    it("parses a clean JSON response", () => {
        const result = parseAnalysisResponse(validJson);
        expect(result).not.toBeNull();
        expect(result?.topic).toBe("Bayes theorem");
        expect(result?.user_level).toBe("beginner");
        expect(result?.recommended_method).toBe("inductive");
        expect(result?.suggested_curriculum?.length).toBe(2);
    });

    it("strips ```json fences", () => {
        const fenced = "```json\n" + validJson + "\n```";
        const result = parseAnalysisResponse(fenced);
        expect(result?.topic).toBe("Bayes theorem");
    });

    it("extracts the first {...} block from surrounding prose", () => {
        const raw = "Sure! Here is the analysis:\n" + validJson + "\nLet me know.";
        const result = parseAnalysisResponse(raw);
        expect(result?.topic).toBe("Bayes theorem");
    });

    it("handles the Haiku prose+fence+trailing-braces failure shape (regression)", () => {
        // The exact shape that broke v0.9.0 with
        // claude-3-5-haiku-latest. The greedy regex matched
        // from the `{weaknesses}` prose-brace through the last
        // closing brace and produced unparseable input.
        const raw =
            "Sure, here's the structured analysis:\n\n" +
            "```json\n" +
            validJson +
            "\n```\n\n" +
            "Let me know if you'd like me to expand on any of the {weaknesses} I identified!";
        const result = parseAnalysisResponse(raw);
        expect(result?.topic).toBe("Bayes theorem");
        expect(result?.user_level).toBe("beginner");
    });

    it("handles prose-braces BEFORE the JSON (regression)", () => {
        const raw =
            "The user wrote `{placeholder}` as a literal in their question. " +
            "Analysis: " +
            validJson;
        const result = parseAnalysisResponse(raw);
        expect(result?.topic).toBe("Bayes theorem");
    });

    it("returns null on invalid JSON", () => {
        expect(parseAnalysisResponse("not json at all")).toBeNull();
    });

    it("returns null on empty input", () => {
        expect(parseAnalysisResponse("")).toBeNull();
        expect(parseAnalysisResponse(null)).toBeNull();
    });

    it("clamps invalid recommended_method to undefined", () => {
        const raw = JSON.stringify({topic: "X", recommended_method: "magic"});
        const result = parseAnalysisResponse(raw);
        expect(result?.recommended_method).toBeUndefined();
    });

    it("clamps invalid user_level to undefined", () => {
        const raw = JSON.stringify({topic: "X", user_level: "expert"});
        const result = parseAnalysisResponse(raw);
        expect(result?.user_level).toBeUndefined();
    });

    it("clamps suggested_curriculum priority to [1, 5]", () => {
        const raw = JSON.stringify({
            topic: "X",
            suggested_curriculum: [
                {title: "Too high", description: "", priority: 99},
                {title: "Too low", description: "", priority: -5},
                {title: "No priority", description: ""},
            ],
        });
        const result = parseAnalysisResponse(raw);
        expect(result?.suggested_curriculum?.[0]?.priority).toBe(5);
        expect(result?.suggested_curriculum?.[1]?.priority).toBe(1);
        expect(result?.suggested_curriculum?.[2]?.priority).toBe(3);
    });

    it("filters empty strings from arrays", () => {
        const raw = JSON.stringify({
            topic: "X",
            strengths: ["", "  ", "real strength"],
        });
        const result = parseAnalysisResponse(raw);
        expect(result?.strengths).toEqual(["real strength"]);
    });
});

describe("chunkMessages", () => {
    function makeMessages(count: number, size: number): NormalizedMessage[] {
        return Array.from({length: count}, (_, i) => ({
            role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
            content: "x".repeat(size),
        }));
    }

    it("returns one chunk when transcript fits", () => {
        const messages = makeMessages(5, 100);
        const chunks = chunkMessages(messages, 10_000);
        expect(chunks.length).toBe(1);
        expect(chunks[0].length).toBe(5);
    });

    it("splits and overlaps by 2 messages", () => {
        const messages = makeMessages(10, 1000);
        const chunks = chunkMessages(messages, 3000);
        expect(chunks.length).toBeGreaterThan(1);
        // Consecutive chunks share 2 messages.
        const last2OfFirst = chunks[0].slice(-2);
        const first2OfSecond = chunks[1].slice(0, 2);
        expect(first2OfSecond[0]?.content).toBe(last2OfFirst[0]?.content);
    });

    it("returns empty array for empty input", () => {
        expect(chunkMessages([], 100)).toEqual([]);
    });
});

describe("mergeAnalyses", () => {
    it("concatenates arrays and dedupes", () => {
        const a = {strengths: ["A", "B"]};
        const b = {strengths: ["B", "C"]};
        const merged = mergeAnalyses(a, b);
        expect(merged.strengths).toEqual(["A", "B", "C"]);
    });

    it("keeps the highest user_level seen", () => {
        const merged = mergeAnalyses(
            {user_level: "beginner"},
            {user_level: "intermediate"},
        );
        expect(merged.user_level).toBe("intermediate");
    });

    it("does not regress user_level", () => {
        const merged = mergeAnalyses(
            {user_level: "advanced"},
            {user_level: "beginner"},
        );
        expect(merged.user_level).toBe("advanced");
    });

    it("keeps first non-empty topic and recommended_method", () => {
        const merged = mergeAnalyses(
            {topic: "Bayes", recommended_method: "inductive"},
            {topic: "Probability", recommended_method: "deductive"},
        );
        expect(merged.topic).toBe("Bayes");
        expect(merged.recommended_method).toBe("inductive");
    });

    it("dedupes suggested_curriculum by title", () => {
        const merged = mergeAnalyses(
            {
                suggested_curriculum: [
                    {title: "Intro", description: "...", priority: 1},
                ],
            },
            {
                suggested_curriculum: [
                    {title: "Intro", description: "duplicate", priority: 2},
                    {title: "Advanced", description: "...", priority: 3},
                ],
            },
        );
        expect(merged.suggested_curriculum?.length).toBe(2);
        expect(merged.suggested_curriculum?.[0]?.description).toBe("...");
    });
});

describe("buildAnalysisUserContent", () => {
    it("labels user vs assistant turns", () => {
        const content = buildAnalysisUserContent([
            {role: "user", content: "Q"},
            {role: "assistant", content: "A"},
        ]);
        expect(content).toContain("Learner: Q");
        expect(content).toContain("AI: A");
    });

    it("includes the title when provided", () => {
        const content = buildAnalysisUserContent(
            [{role: "user", content: "Q"}],
            "Bayes session",
        );
        expect(content).toContain("Title: Bayes session");
    });
});

describe("analyzeConversation", () => {
    beforeEach(() => {
        mockedAiComplete.mockReset();
    });

    it("calls aiComplete once for a short transcript", async () => {
        mockedAiComplete.mockResolvedValueOnce(validJson);
        const result = await analyzeConversation({
            provider: "anthropic",
            apiKey: "fake-key",
            modelOverride: null,
            messages: [
                {role: "user", content: "Q"},
                {role: "assistant", content: "A"},
            ],
        });
        expect(mockedAiComplete).toHaveBeenCalledTimes(1);
        expect(result.topic).toBe("Bayes theorem");
        expect(result.fallback_used).toBeUndefined();
    });

    it("chunks long transcripts and merges results", async () => {
        mockedAiComplete
            .mockResolvedValueOnce(
                JSON.stringify({
                    topic: "X",
                    strengths: ["A"],
                    user_level: "beginner",
                }),
            )
            .mockResolvedValueOnce(
                JSON.stringify({
                    topic: "X2",
                    strengths: ["B"],
                    user_level: "intermediate",
                }),
            );
        const longMessages: NormalizedMessage[] = Array.from(
            {length: 20},
            (_, i) => ({
                role: i % 2 === 0 ? "user" : "assistant",
                content: "x".repeat(2000),
            }),
        );
        const result = await analyzeConversation({
            provider: "openai",
            apiKey: "fake",
            modelOverride: null,
            messages: longMessages,
            maxChunkChars: 8000,
        });
        expect(mockedAiComplete.mock.calls.length).toBeGreaterThan(1);
        expect(result.strengths?.includes("A")).toBe(true);
        expect(result.strengths?.includes("B")).toBe(true);
        expect(result.user_level).toBe("intermediate");
        expect(result.chunk_summaries?.length).toBeGreaterThan(1);
    });

    it("falls back when the AI returns garbage", async () => {
        mockedAiComplete.mockResolvedValueOnce("Sure here you go!");
        const result = await analyzeConversation({
            provider: "anthropic",
            apiKey: "fake",
            modelOverride: null,
            messages: [{role: "user", content: "Q"}],
            title: "Demo",
        });
        expect(result.fallback_used).toBe(true);
        expect(result.topic).toBe("Demo");
    });

    it("falls back when the AI provider throws", async () => {
        mockedAiComplete.mockRejectedValueOnce(new Error("auth: invalid key"));
        const result = await analyzeConversation({
            provider: "anthropic",
            apiKey: "wrong-key",
            modelOverride: null,
            messages: [{role: "user", content: "Q"}],
        });
        expect(result.fallback_used).toBe(true);
        expect(result.summary).toContain("auth: invalid key");
    });

    it("returns immediate fallback on empty messages", async () => {
        const result = await analyzeConversation({
            provider: "anthropic",
            apiKey: "fake",
            modelOverride: null,
            messages: [],
        });
        expect(result.fallback_used).toBe(true);
        expect(mockedAiComplete).not.toHaveBeenCalled();
    });
});

describe("deterministicFallback", () => {
    it("flags fallback_used: true", () => {
        const result = deterministicFallback("Title");
        expect(result.fallback_used).toBe(true);
        expect(result.topic).toBe("Title");
    });
});

// --- Phase 36 Bug 2 — analysis-language passthrough -----------------------

describe("buildSystemPrompt (Phase 36 Bug 2)", () => {
    it("names every supported language in the directive", () => {
        for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
            const prompt = buildSystemPrompt(code);
            expect(prompt).toContain("LANGUAGE — IMPORTANT");
            expect(prompt).toContain(`IN ${name}`);
        }
    });

    it("falls back to English for unknown / empty codes", () => {
        for (const bogus of ["xx", "", "  ", "klingon"]) {
            const prompt = buildSystemPrompt(bogus);
            expect(prompt).toContain("IN English");
            expect(prompt).toContain("LANGUAGE — IMPORTANT");
        }
    });

    it("normalises case (DE and de resolve to German)", () => {
        expect(buildSystemPrompt("DE")).toContain("IN German");
        expect(buildSystemPrompt("de")).toContain("IN German");
    });

    it("explicitly keeps enum identifiers untranslated", () => {
        const prompt = buildSystemPrompt("de");
        expect(prompt).toContain(
            "user_level enum values: beginner / intermediate / advanced",
        );
        expect(prompt).toContain(
            "recommended_method enum values: deductive / inductive /",
        );
    });
});

describe("analyzeConversation lang passthrough (Phase 36 Bug 2)", () => {
    beforeEach(() => {
        mockedAiComplete.mockReset();
    });

    it("includes the German directive when lang='de'", async () => {
        mockedAiComplete.mockResolvedValueOnce(validJson);
        await analyzeConversation({
            provider: "anthropic",
            apiKey: "fake",
            modelOverride: null,
            messages: [{role: "user", content: "Q"}],
            lang: "de",
        });
        const call = mockedAiComplete.mock.calls[0]?.[0];
        const systemMsg = call?.messages.find((m) => m.role === "system");
        expect(systemMsg).toBeDefined();
        expect(systemMsg!.content).toContain("IN German");
    });

    it("defaults to English when lang is omitted (backwards compat)", async () => {
        mockedAiComplete.mockResolvedValueOnce(validJson);
        await analyzeConversation({
            provider: "anthropic",
            apiKey: "fake",
            modelOverride: null,
            messages: [{role: "user", content: "Q"}],
        });
        const call = mockedAiComplete.mock.calls[0]?.[0];
        const systemMsg = call?.messages.find((m) => m.role === "system");
        expect(systemMsg!.content).toContain("IN English");
    });
});
