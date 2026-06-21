/**
 * Tests for the lesson-summary utilities (Phase 46A / C1).
 *
 * Pins:
 * - computeStars: every band boundary, fractional values,
 *   the total=0 edge case (theory-only lessons).
 * - deriveCanonicalAnswer: each of the 4 exercise types +
 *   defensive empty/missing-content paths.
 * - buildExerciseBreakdown: skips theory, handles missing
 *   progress, handles missing per-step entries, preserves
 *   lesson step order, exposes the canonical answer for the
 *   summary UI to reveal on wrong answers.
 */

import {describe, expect, it} from "vitest";

import {
    buildExerciseBreakdown,
    computeStars,
    deriveCanonicalAnswer,
} from "./lesson-summary";
import type {
    ContentLesson,
    ContentLessonExercise,
    LessonProgress,
} from "../../storage/types";

describe("computeStars", () => {
    it("returns 3 stars at 100%", () => {
        expect(computeStars(10, 10)).toBe(3);
    });

    it("returns 3 stars at exactly 90%", () => {
        expect(computeStars(9, 10)).toBe(3);
    });

    it("returns 2 stars at 89.x%", () => {
        // 89/100 = 89%
        expect(computeStars(89, 100)).toBe(2);
    });

    it("returns 2 stars at exactly 75%", () => {
        expect(computeStars(3, 4)).toBe(2);
    });

    it("returns 1 star at 74.x%", () => {
        // 74/100 = 74%
        expect(computeStars(74, 100)).toBe(1);
    });

    it("returns 1 star at exactly 50%", () => {
        expect(computeStars(5, 10)).toBe(1);
    });

    it("returns 0 stars at 49.x%", () => {
        // 49/100 = 49%
        expect(computeStars(49, 100)).toBe(0);
    });

    it("returns 0 stars at 0%", () => {
        expect(computeStars(0, 10)).toBe(0);
    });

    it("returns 0 stars when total is 0 (theory-only lesson)", () => {
        expect(computeStars(0, 0)).toBe(0);
    });

    it("returns 0 stars defensively on negative total", () => {
        // Should never happen at runtime but the guard prevents
        // div-by-zero / NaN propagation.
        expect(computeStars(0, -1)).toBe(0);
    });

    it("handles fractional percentages correctly across bands", () => {
        // 3/5 = 60% → 1 star
        expect(computeStars(3, 5)).toBe(1);
        // 4/5 = 80% → 2 stars
        expect(computeStars(4, 5)).toBe(2);
        // 7/8 = 87.5% → 2 stars
        expect(computeStars(7, 8)).toBe(2);
        // 9/10 = 90% → 3 stars
        expect(computeStars(9, 10)).toBe(3);
    });
});

describe("deriveCanonicalAnswer", () => {
    it("joins matching pairs with separator", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "matching",
            prompt: "Match",
            card_ids: [],
            pairs: [
                {left: "Bonjour", right: "Hello"},
                {left: "Merci", right: "Thank you"},
            ],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe(
            "Bonjour ↔ Hello, Merci ↔ Thank you",
        );
    });

    it("returns the correct image's label for picture_choice", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "picture_choice",
            prompt: "Pick",
            card_ids: [],
            images: [
                {src: "a.png", label: "Cat"},
                {src: "b.png", label: "Dog", is_correct: "true"},
                {src: "c.png", label: "Fish"},
            ],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("Dog");
    });

    it("returns the first accept entry for free_text", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "free_text",
            prompt: "Type it",
            card_ids: [],
            accept: ["Merci", "merci", "Merci."],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("Merci");
    });

    it("returns space-joined tiles for word_tiles", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "word_tiles",
            prompt: "Arrange",
            card_ids: [],
            tiles: ["Au", "revoir"],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("Au revoir");
    });

    it("returns empty string defensively when matching pairs are missing", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "matching",
            prompt: "Match",
            card_ids: [],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("");
    });

    it("returns empty string defensively when no picture is marked correct", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "picture_choice",
            prompt: "Pick",
            card_ids: [],
            images: [
                {src: "a.png", label: "Cat"},
                {src: "b.png", label: "Dog"},
            ],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("");
    });

    it("returns empty string defensively when accept is missing", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "free_text",
            prompt: "Type it",
            card_ids: [],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("");
    });

    it("returns empty string defensively when tiles is missing", () => {
        const ex: ContentLessonExercise = {
            id: "ex-1",
            type: "word_tiles",
            prompt: "Arrange",
            card_ids: [],
            distractors: [],
        };
        expect(deriveCanonicalAnswer(ex)).toBe("");
    });
});

describe("buildExerciseBreakdown", () => {
    const LESSON: ContentLesson = {
        id: "01-greetings",
        title: "Greetings",
        description: null,
        estimated_minutes: 10,
        cards: [],
        steps: [
            {
                id: "intro",
                type: "theory",
                title: "Intro",
                body: "# Welcome",
            },
            {
                id: "ex-match",
                type: "exercise",
                title: "Match the words",
                exercise: {
                    id: "ex-match",
                    type: "matching",
                    prompt: "Match",
                    card_ids: [],
                    pairs: [
                        {left: "Bonjour", right: "Hello"},
                        {left: "Merci", right: "Thank you"},
                    ],
                    distractors: [],
                },
            },
            {
                id: "after-theory",
                type: "theory",
                title: "Recap",
                body: "Well done!",
            },
            {
                id: "ex-free",
                type: "exercise",
                title: "Type the farewell",
                exercise: {
                    id: "ex-free",
                    type: "free_text",
                    prompt: "How do you say goodbye?",
                    card_ids: [],
                    accept: ["Au revoir"],
                    distractors: [],
                },
            },
            {
                id: "ex-tiles",
                type: "exercise",
                title: "Arrange the greeting",
                exercise: {
                    id: "ex-tiles",
                    type: "word_tiles",
                    prompt: "Arrange",
                    card_ids: [],
                    tiles: ["Bon", "soir"],
                    distractors: [],
                },
            },
        ],
    };

    const PROGRESS_BASE: LessonProgress = {
        id: "row-1",
        user_id: "user-1",
        source: "owner/name",
        set_id: "set-1",
        lesson_filename: "01.json",
        status: "in_progress",
        step_results: {},
        score_correct: 0,
        score_total: 0,
        time_spent_seconds: 0,
        started_at: "2026-05-27T00:00:00Z",
        updated_at: "2026-05-27T00:00:00Z",
        completed_at: null,
        paused_at: null,
        abandoned_at: null,
    };

    it("returns exactly one entry per exercise step, in lesson order", () => {
        const entries = buildExerciseBreakdown(LESSON, PROGRESS_BASE);
        expect(entries.map((e) => e.stepId)).toEqual([
            "ex-match",
            "ex-free",
            "ex-tiles",
        ]);
    });

    it("skips theory steps entirely", () => {
        const entries = buildExerciseBreakdown(LESSON, PROGRESS_BASE);
        expect(entries.find((e) => e.stepId === "intro")).toBeUndefined();
        expect(
            entries.find((e) => e.stepId === "after-theory"),
        ).toBeUndefined();
    });

    it("marks attempted=false when there is no step_result entry", () => {
        const entries = buildExerciseBreakdown(LESSON, PROGRESS_BASE);
        for (const entry of entries) {
            expect(entry.attempted).toBe(false);
            expect(entry.correct).toBe(0);
            expect(entry.total).toBe(0);
            expect(entry.fullyCorrect).toBe(false);
        }
    });

    it("reads correct/total from step_results when present", () => {
        const progress: LessonProgress = {
            ...PROGRESS_BASE,
            step_results: {
                "ex-match": {
                    correct: 1,
                    total: 2,
                    attempts: 1,
                    completed_at: "2026-05-27T00:01:00Z",
                },
                "ex-free": {
                    correct: 1,
                    total: 1,
                    attempts: 1,
                    completed_at: "2026-05-27T00:02:00Z",
                },
                // ex-tiles unattempted
            },
        };
        const entries = buildExerciseBreakdown(LESSON, progress);
        const match = entries.find((e) => e.stepId === "ex-match")!;
        expect(match.attempted).toBe(true);
        expect(match.correct).toBe(1);
        expect(match.total).toBe(2);
        expect(match.fullyCorrect).toBe(false);

        const free = entries.find((e) => e.stepId === "ex-free")!;
        expect(free.attempted).toBe(true);
        expect(free.fullyCorrect).toBe(true);

        const tiles = entries.find((e) => e.stepId === "ex-tiles")!;
        expect(tiles.attempted).toBe(false);
        expect(tiles.fullyCorrect).toBe(false);
    });

    it("does NOT flag fullyCorrect when total is 0 (unattempted)", () => {
        // Defensive: avoid false-positive "perfect score" badges
        // on rows the user never tried.
        const progress: LessonProgress = {
            ...PROGRESS_BASE,
            step_results: {
                "ex-match": {
                    correct: 0,
                    total: 0,
                    attempts: 0,
                    completed_at: "2026-05-27T00:01:00Z",
                },
            },
        };
        const entries = buildExerciseBreakdown(LESSON, progress);
        const match = entries.find((e) => e.stepId === "ex-match")!;
        expect(match.fullyCorrect).toBe(false);
    });

    it("uses the step title when present, falls back to the exercise prompt", () => {
        const lessonNoStepTitles: ContentLesson = {
            ...LESSON,
            steps: LESSON.steps.map((s) =>
                s.type === "exercise"
                    ? {...s, title: null}
                    : s,
            ),
        };
        const entries = buildExerciseBreakdown(
            lessonNoStepTitles,
            PROGRESS_BASE,
        );
        const free = entries.find((e) => e.stepId === "ex-free")!;
        expect(free.title).toBe("How do you say goodbye?");
    });

    it("attaches the canonical answer to every entry", () => {
        const entries = buildExerciseBreakdown(LESSON, PROGRESS_BASE);
        const match = entries.find((e) => e.stepId === "ex-match")!;
        expect(match.canonicalAnswer).toBe(
            "Bonjour ↔ Hello, Merci ↔ Thank you",
        );
        const free = entries.find((e) => e.stepId === "ex-free")!;
        expect(free.canonicalAnswer).toBe("Au revoir");
        const tiles = entries.find((e) => e.stepId === "ex-tiles")!;
        expect(tiles.canonicalAnswer).toBe("Bon soir");
    });

    // Phase 52C / v1.35.0 — user_answer plumbing
    it("returns userAnswer=null when the step has no stored user_answer", () => {
        const entries = buildExerciseBreakdown(LESSON, PROGRESS_BASE);
        for (const entry of entries) {
            expect(entry.userAnswer).toBeNull();
        }
    });

    it("reads userAnswer from step_results[step].user_answer when present", () => {
        const progress: LessonProgress = {
            ...PROGRESS_BASE,
            step_results: {
                "ex-free": {
                    correct: 0,
                    total: 1,
                    attempts: 1,
                    completed_at: "2026-05-27T00:02:00Z",
                    user_answer: "bonjour",
                },
                "ex-tiles": {
                    correct: 1,
                    total: 1,
                    attempts: 1,
                    completed_at: "2026-05-27T00:03:00Z",
                    user_answer: "Bon soir",
                },
            },
        };
        const entries = buildExerciseBreakdown(LESSON, progress);
        const free = entries.find((e) => e.stepId === "ex-free")!;
        expect(free.userAnswer).toBe("bonjour");
        const tiles = entries.find((e) => e.stepId === "ex-tiles")!;
        expect(tiles.userAnswer).toBe("Bon soir");
        const match = entries.find((e) => e.stepId === "ex-match")!;
        // ex-match has no result -> userAnswer null (defaults)
        expect(match.userAnswer).toBeNull();
    });

    it("handles null progress (lesson never started) by returning all-unattempted entries", () => {
        const entries = buildExerciseBreakdown(LESSON, null);
        expect(entries).toHaveLength(3);
        for (const entry of entries) {
            expect(entry.attempted).toBe(false);
            expect(entry.correct).toBe(0);
            expect(entry.total).toBe(0);
        }
    });

    it("returns empty list for a theory-only lesson", () => {
        const theoryOnly: ContentLesson = {
            ...LESSON,
            steps: [
                {
                    id: "t1",
                    type: "theory",
                    title: "Only theory",
                    body: "Hello",
                },
            ],
        };
        expect(buildExerciseBreakdown(theoryOnly, PROGRESS_BASE)).toEqual(
            [],
        );
    });

    it("defensively skips an exercise step that's missing its exercise payload", () => {
        // Schema validator rejects this upstream, but a corrupted
        // cache shouldn't crash the summary screen.
        const broken: ContentLesson = {
            ...LESSON,
            steps: [
                {
                    id: "ex-broken",
                    type: "exercise",
                    title: "Broken",
                    exercise: null,
                },
            ],
        };
        expect(buildExerciseBreakdown(broken, PROGRESS_BASE)).toEqual([]);
    });
});
