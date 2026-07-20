/**
 * Tests for the per-type exercise-edit validator + normalizer (#1844).
 *
 * These pin the validation rules that gate the Step-3 inline editor's
 * Save button (empty prompt, too few pairs/tiles, no accepted answer,
 * cloze marker/blank mismatch, picture-choice correctness) and the
 * normalizer that trims + drops empty entries before the edit is
 * committed to the exercise record. Pure functions — no React.
 */

import {describe, expect, it} from "vitest";

import {
    FREE_TEXT_MIN_ACCEPT,
    MATCHING_MIN_PAIRS,
    MC_MIN_OPTIONS,
    PICTURE_MIN_IMAGES,
    WORD_TILES_MIN_TILES,
    countClozeMarkers,
    createBlankExercise,
    newExerciseId,
    normalizeExerciseEdit,
    validateExerciseEdit,
} from "./exercise-edit";
import type {ContentLessonExercise} from "../../../../storage/types";

function base(over: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {
        id: "ex-1",
        type: "free_text",
        prompt: "Translate: Bonjour",
        card_ids: [],
        distractors: [],
        ...over,
    } as ContentLessonExercise;
}

describe("countClozeMarkers", () => {
    it("counts each ___ occurrence", () => {
        expect(countClozeMarkers("Je ___ un ___.")).toBe(2);
        expect(countClozeMarkers("no blanks here")).toBe(0);
        expect(countClozeMarkers(null)).toBe(0);
    });
});

describe("validateExerciseEdit — prompt", () => {
    it("rejects an empty/whitespace prompt on any type", () => {
        const res = validateExerciseEdit(base({prompt: "   ", accept: ["x"]}));
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("prompt");
    });
});

describe("validateExerciseEdit — free_text", () => {
    it("accepts a prompt with at least one accepted answer", () => {
        expect(
            validateExerciseEdit(base({type: "free_text", accept: ["Guten Tag"]}))
                .valid,
        ).toBe(true);
    });
    it(`rejects fewer than ${FREE_TEXT_MIN_ACCEPT} accepted answers`, () => {
        const res = validateExerciseEdit(
            base({type: "free_text", accept: ["  "]}),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("free_text");
    });
});

describe("validateExerciseEdit — matching", () => {
    it("accepts >= min complete pairs", () => {
        const res = validateExerciseEdit(
            base({
                type: "matching",
                prompt: "Match",
                pairs: [
                    {left: "un", right: "one"},
                    {left: "deux", right: "two"},
                ],
            }),
        );
        expect(res.valid).toBe(true);
    });
    it(`rejects fewer than ${MATCHING_MIN_PAIRS} complete pairs`, () => {
        const res = validateExerciseEdit(
            base({
                type: "matching",
                prompt: "Match",
                pairs: [
                    {left: "un", right: "one"},
                    {left: "deux", right: "  "},
                ],
            }),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("matching");
    });
});

describe("validateExerciseEdit — cloze", () => {
    it("accepts marker count == blanks with non-empty accepts", () => {
        const res = validateExerciseEdit(
            base({
                type: "cloze",
                prompt: "Fill in",
                sentence: "Je ___ un livre.",
                blanks: [{accept: ["lis"]}],
            }),
        );
        expect(res.valid).toBe(true);
    });
    it("rejects a sentence with no ___ marker", () => {
        const res = validateExerciseEdit(
            base({
                type: "cloze",
                prompt: "Fill in",
                sentence: "No blank here.",
                blanks: [],
            }),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("cloze");
    });
    it("rejects when a blank has no accepted answer", () => {
        const res = validateExerciseEdit(
            base({
                type: "cloze",
                prompt: "Fill in",
                sentence: "Je ___ un livre.",
                blanks: [{accept: ["   "]}],
            }),
        );
        expect(res.valid).toBe(false);
    });
    it("rejects when marker count != blanks length", () => {
        const res = validateExerciseEdit(
            base({
                type: "cloze",
                prompt: "Fill in",
                sentence: "Je ___ un ___.",
                blanks: [{accept: ["lis"]}],
            }),
        );
        expect(res.valid).toBe(false);
    });
});

describe("validateExerciseEdit — word_tiles", () => {
    it("accepts >= min tiles", () => {
        const res = validateExerciseEdit(
            base({
                type: "word_tiles",
                prompt: "Arrange",
                tiles: ["Je", "lis"],
            }),
        );
        expect(res.valid).toBe(true);
    });
    it(`rejects fewer than ${WORD_TILES_MIN_TILES} tiles`, () => {
        const res = validateExerciseEdit(
            base({type: "word_tiles", prompt: "Arrange", tiles: ["Je"]}),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("word_tiles");
    });
});

describe("validateExerciseEdit — picture_choice", () => {
    it("accepts >= min images with exactly one correct + labels + src", () => {
        const res = validateExerciseEdit(
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [
                    {src: "a.png", label: "cat", is_correct: "true"},
                    {src: "b.png", label: "dog"},
                ],
            }),
        );
        expect(res.valid).toBe(true);
    });
    it("rejects when no image is marked correct", () => {
        const res = validateExerciseEdit(
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [
                    {src: "a.png", label: "cat"},
                    {src: "b.png", label: "dog"},
                ],
            }),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("picture_choice");
    });
    it("rejects when an image is missing src or label", () => {
        const res = validateExerciseEdit(
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [
                    {src: "a.png", label: "cat", is_correct: "true"},
                    {src: "", label: "dog"},
                ],
            }),
        );
        expect(res.valid).toBe(false);
    });
    it(`rejects fewer than ${PICTURE_MIN_IMAGES} images`, () => {
        const res = validateExerciseEdit(
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [{src: "a.png", label: "cat", is_correct: "true"}],
            }),
        );
        expect(res.valid).toBe(false);
    });
});

describe("normalizeExerciseEdit", () => {
    it("trims the prompt and free_text accepts, dropping empties", () => {
        const out = normalizeExerciseEdit(
            base({type: "free_text", prompt: "  Translate  ", accept: ["a ", " ", "b"]}),
        );
        expect(out.prompt).toBe("Translate");
        expect(out.accept).toEqual(["a", "b"]);
    });
    it("trims matching pairs and drops incomplete ones", () => {
        const out = normalizeExerciseEdit(
            base({
                type: "matching",
                prompt: "Match",
                pairs: [
                    {left: " un ", right: " one "},
                    {left: "deux", right: "  "},
                ],
            }),
        );
        expect(out.pairs).toEqual([{left: "un", right: "one"}]);
    });
    it("trims word_tiles but keeps legitimate duplicates + order", () => {
        const out = normalizeExerciseEdit(
            base({
                type: "word_tiles",
                prompt: "Arrange",
                tiles: [" the ", "cat", "the", " "],
            }),
        );
        expect(out.tiles).toEqual(["the", "cat", "the"]);
    });
    it("syncs cloze blanks to the marker count", () => {
        const out = normalizeExerciseEdit(
            base({
                type: "cloze",
                prompt: "Fill",
                sentence: "Je ___ un ___.",
                blanks: [{accept: ["lis "]}],
            }),
        );
        expect(out.blanks).toHaveLength(2);
        expect(out.blanks?.[0].accept).toEqual(["lis"]);
        expect(out.blanks?.[1].accept).toEqual([]);
    });
    it("preserves id, type, card_ids and distractors", () => {
        const out = normalizeExerciseEdit(
            base({
                id: "keep-me",
                type: "free_text",
                accept: ["x"],
                card_ids: ["c1"],
                distractors: ["d1"],
            }),
        );
        expect(out.id).toBe("keep-me");
        expect(out.type).toBe("free_text");
        expect(out.card_ids).toEqual(["c1"]);
        expect(out.distractors).toEqual(["d1"]);
    });
});

describe("validateExerciseEdit — multiple_choice (#1850)", () => {
    function mc(over: Partial<ContentLessonExercise>): ContentLessonExercise {
        return base({
            type: "multiple_choice",
            prompt: "Pick the translation of chat",
            multiple: false,
            options: [
                {text: "cat", correct: true},
                {text: "dog", correct: false},
            ],
            ...over,
        });
    }

    it("accepts >= min options with exactly one correct (single)", () => {
        expect(validateExerciseEdit(mc({})).valid).toBe(true);
    });
    it(`rejects fewer than ${MC_MIN_OPTIONS} non-empty options`, () => {
        const res = validateExerciseEdit(
            mc({options: [{text: "cat", correct: true}, {text: "  ", correct: false}]}),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("multiple_choice");
    });
    it("rejects duplicate option texts", () => {
        const res = validateExerciseEdit(
            mc({options: [{text: "cat", correct: true}, {text: "cat", correct: false}]}),
        );
        expect(res.valid).toBe(false);
    });
    it("rejects single-choice with no correct option", () => {
        const res = validateExerciseEdit(
            mc({options: [{text: "cat", correct: false}, {text: "dog", correct: false}]}),
        );
        expect(res.valid).toBe(false);
    });
    it("rejects single-choice with two correct options", () => {
        const res = validateExerciseEdit(
            mc({options: [{text: "cat", correct: true}, {text: "dog", correct: true}]}),
        );
        expect(res.valid).toBe(false);
    });
    it("accepts multi-choice with two correct options", () => {
        expect(
            validateExerciseEdit(
                mc({
                    multiple: true,
                    options: [
                        {text: "cat", correct: true},
                        {text: "feline", correct: true},
                        {text: "dog", correct: false},
                    ],
                }),
            ).valid,
        ).toBe(true);
    });
    it("rejects multi-choice with no correct option", () => {
        expect(
            validateExerciseEdit(
                mc({
                    multiple: true,
                    options: [
                        {text: "cat", correct: false},
                        {text: "dog", correct: false},
                    ],
                }),
            ).valid,
        ).toBe(false);
    });
});

describe("normalizeExerciseEdit — multiple_choice (#1850)", () => {
    it("trims option texts, drops empties, coerces booleans", () => {
        const out = normalizeExerciseEdit(
            base({
                type: "multiple_choice",
                prompt: "  Pick  ",
                multiple: false,
                options: [
                    {text: " cat ", correct: true},
                    {text: " ", correct: false},
                    {text: "dog", correct: false},
                ],
            }),
        );
        expect(out.prompt).toBe("Pick");
        expect(out.options).toEqual([
            {text: "cat", correct: true},
            {text: "dog", correct: false},
        ]);
        expect(out.multiple).toBe(false);
    });
});

describe("createBlankExercise + newExerciseId (#1849)", () => {
    it("produces a fresh unique id each call", () => {
        const a = newExerciseId();
        const b = newExerciseId();
        expect(a).not.toBe(b);
        expect(a.startsWith("ex-manual-")).toBe(true);
    });

    const TYPES = [
        "matching",
        "free_text",
        "cloze",
        "word_tiles",
        "picture_choice",
        "multiple_choice",
    ] as const;

    it("builds a blank of each type that is INVALID until filled", () => {
        for (const type of TYPES) {
            const ex = createBlankExercise(type, `id-${type}`);
            expect(ex.type).toBe(type);
            expect(ex.id).toBe(`id-${type}`);
            // Empty prompt alone makes every blank invalid to start.
            expect(validateExerciseEdit(ex).valid).toBe(false);
        }
    });

    it("matching blank has two empty pair slots", () => {
        const ex = createBlankExercise("matching", "m");
        expect(ex.pairs).toHaveLength(2);
        expect(ex.pairs?.[0]).toEqual({left: "", right: ""});
    });
    it("multiple_choice blank has two empty single-choice options", () => {
        const ex = createBlankExercise("multiple_choice", "mc");
        expect(ex.multiple).toBe(false);
        expect(ex.options).toHaveLength(2);
        expect(ex.options?.[0]).toEqual({text: "", correct: false});
    });
    it("cloze blank has one marker + one blank", () => {
        const ex = createBlankExercise("cloze", "c");
        expect(ex.sentence).toBe("___");
        expect(ex.blanks).toHaveLength(1);
    });
});
