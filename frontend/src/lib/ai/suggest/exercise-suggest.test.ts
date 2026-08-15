/**
 * Tests for the Stage-4 AI-suggest helpers (EXP-050, #2511).
 *
 * The model call is a fake {@link AiProvider} returning a canned reply, so these
 * pin the deterministic halves: prompt-reply parsing, the non-destructive +
 * quality gate on distractors, the cloze blank-out, and the passage guard. Pure
 * functions, no React, no network.
 */

import {describe, expect, it, vi} from "vitest";

import {
    blankOutAnswer,
    keepUsableDistractors,
    parseSuggestionList,
    suggestClozeSentence,
    suggestDistractors,
    suggestPassage,
    TARGET_DISTRACTOR_COUNT,
} from "./exercise-suggest";
import type {AiProvider} from "../generation/generate-exercises";
import type {ContentLessonExercise} from "../../../storage/types";

/** A provider that returns a fixed reply and records the prompt it saw. */
function fakeProvider(reply: string): AiProvider & {prompt: () => string} {
    let seen = "";
    return {
        complete: async (prompt: string) => {
            seen = prompt;
            return reply;
        },
        prompt: () => seen,
    };
}

function base(over: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {
        id: "ex-1",
        type: "free_text",
        prompt: "Translate: danke",
        card_ids: [],
        distractors: [],
        ...over,
    } as ContentLessonExercise;
}

describe("parseSuggestionList", () => {
    it("parses a JSON array", () => {
        expect(parseSuggestionList('["bitte", "hallo"]')).toEqual(["bitte", "hallo"]);
    });

    it("strips a ```json fence", () => {
        expect(parseSuggestionList('```json\n["a","b"]\n```')).toEqual(["a", "b"]);
    });

    it("falls back to splitting bullet / numbered lines", () => {
        expect(parseSuggestionList("- bitte\n2. hallo\n* tschüss")).toEqual([
            "bitte",
            "hallo",
            "tschüss",
        ]);
    });
});

describe("keepUsableDistractors", () => {
    it("drops the correct answer, duplicates, and too-short entries", () => {
        const kept = keepUsableDistractors(
            ["danke", "bitte", "BITTE", "x", "hallo"],
            ["danke"],
            [],
        );
        expect(kept).toEqual(["bitte", "hallo"]);
    });

    it("drops options already present", () => {
        expect(
            keepUsableDistractors(["bitte", "hallo"], ["danke"], ["bitte"]),
        ).toEqual(["hallo"]);
    });
});

describe("suggestDistractors", () => {
    const mc = (over: Partial<ContentLessonExercise> = {}) =>
        base({
            type: "multiple_choice",
            accept: ["danke"],
            options: [{text: "danke", correct: true}],
            ...over,
        });

    it("returns gated distractors up to the target count", async () => {
        const out = await suggestDistractors(
            mc(),
            fakeProvider('["bitte", "hallo", "tschüss", "danke"]'),
        );
        // "danke" (the answer) is dropped; three usable remain.
        expect(out).toEqual(["bitte", "hallo", "tschüss"]);
        expect(out.length).toBeLessThanOrEqual(TARGET_DISTRACTOR_COUNT);
    });

    it("only asks for the options still missing", async () => {
        const provider = fakeProvider('["neu"]');
        const out = await suggestDistractors(
            mc({
                options: [
                    {text: "danke", correct: true},
                    {text: "bitte", correct: false},
                    {text: "hallo", correct: false},
                ],
            }),
            provider,
        );
        expect(out).toEqual(["neu"]); // needed = 3 - 2 = 1
        expect(provider.prompt()).toContain("exactly 1");
    });

    it("returns [] with no answer and does not call the model", async () => {
        const complete = vi.fn();
        const out = await suggestDistractors(
            mc({accept: [], options: [{text: "", correct: true}]}),
            {complete},
        );
        expect(out).toEqual([]);
        expect(complete).not.toHaveBeenCalled();
    });

    it("derives the answer from the correct option when accept is absent", async () => {
        const out = await suggestDistractors(
            base({
                type: "multiple_choice",
                options: [{text: "danke", correct: true}],
            }),
            fakeProvider('["bitte", "hallo", "tschüss", "danke"]'),
        );
        // "danke" (the correct option) is excluded as a distractor.
        expect(out).toEqual(["bitte", "hallo", "tschüss"]);
    });

    it("returns [] when the wrong options are already complete", async () => {
        const complete = vi.fn();
        const out = await suggestDistractors(
            mc({
                options: [
                    {text: "danke", correct: true},
                    {text: "a", correct: false},
                    {text: "b", correct: false},
                    {text: "c", correct: false},
                ],
            }),
            {complete},
        );
        expect(out).toEqual([]);
        expect(complete).not.toHaveBeenCalled();
    });
});

describe("blankOutAnswer", () => {
    it("replaces the first occurrence with ___", () => {
        expect(blankOutAnswer("Je suis ici", "suis")).toBe("Je ___ ici");
    });

    it("is case-insensitive and returns null when the answer is absent", () => {
        expect(blankOutAnswer("Je SUIS ici", "suis")).toBe("Je ___ ici");
        expect(blankOutAnswer("Nothing here", "suis")).toBeNull();
    });
});

describe("suggestClozeSentence", () => {
    const cloze = (over: Partial<ContentLessonExercise> = {}) =>
        base({type: "cloze", blanks: [{accept: ["suis"]}], ...over});

    it("returns the model sentence with the answer blanked out", async () => {
        const out = await suggestClozeSentence(
            cloze(),
            fakeProvider('"Je suis ici avec toi."'),
        );
        expect(out).toBe("Je ___ ici avec toi.");
    });

    it("returns null when the model's sentence omits the answer", async () => {
        expect(
            await suggestClozeSentence(cloze(), fakeProvider("No target word here.")),
        ).toBeNull();
    });
});

describe("suggestPassage", () => {
    const rc = (over: Partial<ContentLessonExercise> = {}) =>
        base({
            type: "ext:al-reading-comprehension",
            ext_payload: {
                passage: "",
                questions: [{prompt: "Where did the dog run?", type: "free_text", accept: ["garden"]}],
            },
            ...over,
        });

    it("returns a passage long enough to be real", async () => {
        const passage = "The dog ran into the garden and played all afternoon in the sun.";
        expect(await suggestPassage(rc(), fakeProvider(passage))).toBe(passage);
    });

    it("returns null for a too-short reply", async () => {
        expect(await suggestPassage(rc(), fakeProvider("Too short."))).toBeNull();
    });

    it("reads questions from a graded-quiz payload too", async () => {
        const provider = fakeProvider("x");
        await suggestPassage(
            base({
                type: "ext:al-graded-quiz",
                ext_payload: {
                    pass_threshold: 60,
                    questions: [{prompt: "What colour?", type: "free_text", accept: ["red"], points: 1}],
                },
            }),
            provider,
        );
        expect(provider.prompt()).toContain("What colour?");
    });
});
