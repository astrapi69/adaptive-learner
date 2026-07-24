import {describe, it, expect, vi} from "vitest";

import {
    generateBookLessonContent,
    generateBookLessonsBatch,
    BookGenerationError,
} from "./generate-book-lessons";
import type {AiProvider} from "./generate-exercises";
import type {TheoryGenerationResult} from "./generate-theory-from-text";
import type {ExerciseGenerationResult} from "./generate-exercises";

const PROVIDER = {} as AiProvider;

function theoryOk(title: string): () => Promise<TheoryGenerationResult> {
    return async () => ({
        steps: [{id: "theory-1", title, body: `Body about ${title}.`}],
        errors: [],
    });
}

const exercisesOk = async (): Promise<ExerciseGenerationResult> => ({
    cards: [
        {
            type: "free_text",
            question: "Q?",
            accepts: ["a"],
            distractors: [],
        },
    ],
    skipped: 0,
    errors: [],
    rejected: [],
    warnings: [],
});

const OPTS = {clozePrompt: "Fill in.", language: "de"};

describe("generateBookLessonContent", () => {
    it("returns theory steps and exercises for a chunk", async () => {
        const result = await generateBookLessonContent("some text", PROVIDER, OPTS, {
            generateTheory: theoryOk("Reize"),
            generate: exercisesOk,
        });
        expect(result.theorySteps).toHaveLength(1);
        expect(result.exercises).toHaveLength(1);
        expect(result.exercises[0].type).toBe("free_text");
    });

    it("throws BookGenerationError('theory') when no theory comes back", async () => {
        const emptyTheory = async (): Promise<TheoryGenerationResult> => ({
            steps: [],
            errors: ["empty"],
        });
        await expect(
            generateBookLessonContent("t", PROVIDER, OPTS, {
                generateTheory: emptyTheory,
                generate: exercisesOk,
            }),
        ).rejects.toMatchObject({reason: "theory"});
    });

    it("throws BookGenerationError('exercises') when no exercise comes back", async () => {
        const emptyExercises = async (): Promise<ExerciseGenerationResult> => ({
            cards: [],
            skipped: 0,
            errors: [],
            rejected: [],
            warnings: [],
        });
        await expect(
            generateBookLessonContent("t", PROVIDER, OPTS, {
                generateTheory: theoryOk("X"),
                generate: emptyExercises,
            }),
        ).rejects.toBeInstanceOf(BookGenerationError);
    });
});

describe("generateBookLessonsBatch", () => {
    const sections = [
        {title: "Kapitel 1", text: "one"},
        {title: "Kapitel 2", text: "two"},
        {title: "Kapitel 3", text: "three"},
    ];

    it("produces one lesson per section in input (document) order", async () => {
        const result = await generateBookLessonsBatch(sections, PROVIDER, OPTS, {
            engines: {
                generateTheory: (text) => theoryOk(`T-${text}`)(),
                generate: exercisesOk,
            },
        });
        expect(result.failures).toEqual([]);
        expect(result.lessons.map((l) => l.title)).toEqual([
            "Kapitel 1",
            "Kapitel 2",
            "Kapitel 3",
        ]);
        expect(result.lessons[0].theorySteps).toHaveLength(1);
        expect(result.lessons[0].exercises).toHaveLength(1);
    });

    it("reports progress per section (1-based, with the title)", async () => {
        const onProgress = vi.fn();
        await generateBookLessonsBatch(sections, PROVIDER, OPTS, {
            engines: {generateTheory: () => theoryOk("x")(), generate: exercisesOk},
            onProgress,
        });
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(onProgress).toHaveBeenNthCalledWith(1, {
            current: 1,
            total: 3,
            title: "Kapitel 1",
        });
        expect(onProgress).toHaveBeenNthCalledWith(3, {
            current: 3,
            total: 3,
            title: "Kapitel 3",
        });
    });

    it("does not abort the batch when one section fails", async () => {
        const generateTheory = vi.fn(async (text: string) => {
            if (text === "two") throw new Error("HTTP 500");
            return {
                steps: [{id: "theory-1", title: "ok", body: "b"}],
                errors: [],
            } as TheoryGenerationResult;
        });
        const result = await generateBookLessonsBatch(sections, PROVIDER, OPTS, {
            engines: {generateTheory, generate: exercisesOk},
        });
        expect(result.lessons.map((l) => l.title)).toEqual([
            "Kapitel 1",
            "Kapitel 3",
        ]);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].title).toBe("Kapitel 2");
        expect(result.failures[0].error).toContain("HTTP 500");
    });

    it("records an oversized section as a failure without calling the AI", async () => {
        const generateTheory = vi.fn(() => theoryOk("x")());
        const oversized = [{title: "Huge", text: "x".repeat(10)}];
        const result = await generateBookLessonsBatch(oversized, PROVIDER, OPTS, {
            engines: {generateTheory, generate: exercisesOk},
            maxSectionChars: 5,
        });
        expect(result.lessons).toEqual([]);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].title).toBe("Huge");
        expect(generateTheory).not.toHaveBeenCalled();
    });
});
