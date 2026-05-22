/**
 * Pure-helper tests for the NotebookLM ZIP exporter
 * (Phase 32A).
 *
 * JSZip + storage are NOT exercised here — those are
 * integration tests filed for a Playwright spec. These tests
 * pin the Markdown body generators, which is where the actual
 * NotebookLM-source contract lives.
 */

import {describe, expect, it} from "vitest";

import {_testing} from "./notebooklm-package";

const {
    buildSummary,
    buildVocabulary,
    buildRules,
    buildErrors,
    buildFlashcards,
    buildSessionExcerpt,
} = _testing;

// --- summary -----------------------------------------------------------

describe("buildSummary", () => {
    it("emits H1 with the project topic + key meta", () => {
        const md = buildSummary({
            project: {
                id: "p1",
                user_id: "u1",
                topic: "Spanish",
                goal: "Reach B1",
                timeframe: "3m",
                daily_minutes: 30,
                current_problem: null,
                active: true,
                created_at: "2026-05-22T00:00:00Z",
                updated_at: "2026-05-22T00:00:00Z",
            } as any,
            profile: null,
            progress: null,
            questions: [],
            vocabulary: [],
        });
        expect(md).toMatch(/^# Spanish/);
        expect(md).toContain("Goal: Reach B1");
        expect(md).toContain("Timeframe: 3m");
        expect(md).toContain("Daily target: 30 minutes");
    });

    it("includes profile section when present", () => {
        const md = buildSummary({
            project: {
                topic: "x",
                goal: "y",
                timeframe: "z",
                daily_minutes: 30,
            } as any,
            profile: {
                deductive: 0.5,
                inductive: 0.4,
                error_based: 0.0,
                dialogic: 0.0,
                contextual: 0.0,
                ai_adaptive: 0.0,
            } as any,
            progress: null,
            questions: [],
            vocabulary: [],
        });
        expect(md).toContain("## Learning profile");
        expect(md).toContain("deductive: 0.50");
    });

    it("includes activity counts when tracking present", () => {
        const md = buildSummary({
            project: {topic: "x", goal: "y", timeframe: "z", daily_minutes: 30} as any,
            profile: null,
            progress: {
                tracking: {
                    total_sessions: 7,
                    total_minutes: 120,
                    streak_days: 3,
                    mean_understanding: 0.82,
                    mean_stress: 0.30,
                },
            } as any,
            questions: [],
            vocabulary: [],
        });
        expect(md).toContain("## Activity counts");
        expect(md).toContain("Sessions: 7");
        expect(md).toContain("Total minutes: 120");
        expect(md).toContain("Mean understanding: 82%");
    });

    it("references flashcards/vocabulary files when non-empty", () => {
        const md = buildSummary({
            project: {topic: "x", goal: "y", timeframe: "z", daily_minutes: 30} as any,
            profile: null,
            progress: null,
            questions: [
                {
                    id: "1",
                    question: "Q?",
                    expected_answer: "A.",
                } as any,
            ],
            vocabulary: [
                {word: "hablar", translation: "to speak"} as any,
            ],
        });
        expect(md).toContain("## Open study questions");
        expect(md).toContain("## Vocabulary");
        expect(md).toContain("See flashcards.md");
        expect(md).toContain("See vocabulary.md");
    });
});

// --- vocabulary --------------------------------------------------------

describe("buildVocabulary", () => {
    it("renders a markdown table", () => {
        const md = buildVocabulary([
            {word: "hablar", translation: "to speak", example: "Yo hablo"} as any,
            {word: "comer", translation: "to eat"} as any,
        ]);
        expect(md).toContain("| Word | Translation | Example |");
        expect(md).toContain("| hablar | to speak | Yo hablo |");
        expect(md).toContain("| comer | to eat |  |");
    });

    it("escapes pipe characters so the table doesn't break", () => {
        const md = buildVocabulary([
            {word: "a|b", translation: "x|y", example: "p|q"} as any,
        ]);
        expect(md).toContain("a\\|b");
        expect(md).toContain("x\\|y");
        expect(md).toContain("p\\|q");
    });

    it("returns 'nothing yet' placeholder for empty input", () => {
        const md = buildVocabulary([]);
        expect(md).toContain("# Vocabulary");
        expect(md).toContain("No vocabulary collected yet");
    });
});

// --- rules / errors / flashcards --------------------------------------

describe("buildRules", () => {
    it("renders one block per first-assistant message", () => {
        const md = buildRules([
            "Rule A: ...",
            "Rule B: ...",
        ]);
        expect(md.split("---").length).toBeGreaterThanOrEqual(3);
        expect(md).toContain("Rule A: ...");
        expect(md).toContain("Rule B: ...");
    });

    it("placeholder when no messages", () => {
        const md = buildRules([]);
        expect(md).toContain("No session rules captured yet");
    });
});

describe("buildErrors", () => {
    it("bullets every note", () => {
        const md = buildErrors(["confused subjunctive", "forgot accents"]);
        expect(md).toContain("- confused subjunctive");
        expect(md).toContain("- forgot accents");
    });

    it("placeholder when empty", () => {
        expect(buildErrors([])).toContain("No session notes captured yet");
    });

    it("escapes pipe characters in notes", () => {
        const md = buildErrors(["a|b"]);
        expect(md).toContain("- a\\|b");
    });
});

describe("buildFlashcards", () => {
    it("renders Q:/A: pairs for both questions + anki cards", () => {
        const md = buildFlashcards(
            [
                {
                    question: "What is X?",
                    expected_answer: "X is foo.",
                    topic: "basics",
                    difficulty: "easy",
                } as any,
            ],
            [
                {
                    front: "Hola",
                    back: "Hello",
                    tags: ["greeting"],
                } as any,
            ],
        );
        expect(md).toContain("Q: What is X?");
        expect(md).toContain("A: X is foo.");
        expect(md).toContain("Topic: basics  Difficulty: easy");
        expect(md).toContain("Q: Hola");
        expect(md).toContain("A: Hello");
        expect(md).toContain("Tags: greeting");
    });

    it("placeholder when both inputs empty", () => {
        const md = buildFlashcards([], []);
        expect(md).toContain("No questions or cards saved yet");
    });

    it("falls back to '(no answer yet)' for empty expected_answer", () => {
        const md = buildFlashcards(
            [{question: "Q?", expected_answer: ""} as any],
            [],
        );
        expect(md).toContain("A: (no answer yet)");
    });
});

// --- session excerpt --------------------------------------------------

describe("buildSessionExcerpt", () => {
    it("renders first assistant message under 'Concept introduced'", () => {
        const md = buildSessionExcerpt(
            {
                id: "s1",
                method: "deductive",
                started_at: "2026-05-22T10:00:00Z",
            },
            [
                {id: "m1", role: "system", content: "boot"} as any,
                {
                    id: "m2",
                    role: "assistant",
                    content: "Concept body",
                } as any,
                {id: "m3", role: "user", content: "user reply"} as any,
                {
                    id: "m4",
                    role: "assistant",
                    content: "final assistant",
                } as any,
            ],
        );
        expect(md).toContain("# Session 2026-05-22 (deductive)");
        expect(md).toContain("## Concept introduced");
        expect(md).toContain("Concept body");
        expect(md).toContain("## Final exchange");
        expect(md).toContain("user reply");
        expect(md).toContain("final assistant");
    });

    it("omits 'Final exchange' when only the first assistant message exists", () => {
        const md = buildSessionExcerpt(
            {id: "s1", method: "deductive", started_at: null},
            [
                {
                    id: "m1",
                    role: "assistant",
                    content: "Only one message",
                } as any,
            ],
        );
        expect(md).toContain("## Concept introduced");
        expect(md).not.toContain("## Final exchange");
        // Date fallback when started_at is null.
        expect(md).toContain("unknown date");
    });
});
