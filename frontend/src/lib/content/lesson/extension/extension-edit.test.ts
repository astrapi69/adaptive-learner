/**
 * Tests for the extension blank-factory + validation (#1852).
 */

import {describe, expect, it} from "vitest";

import {
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    createBlankExtensionExercise,
    newExtensionExerciseId,
    normalizeExtensionExercise,
    validateExtensionExercise,
} from "./extension-edit";
import type {ContentLessonExercise} from "../../../../storage/types";

function cat(payload: unknown, prompt = "Sort the signals"): ContentLessonExercise {
    return {
        id: "c1",
        type: CATEGORIZATION_EXT_TYPE,
        prompt,
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    } as ContentLessonExercise;
}
function ec(payload: unknown, prompt = "Fix the wrong word"): ContentLessonExercise {
    return {
        id: "e1",
        type: ERROR_CORRECTION_EXT_TYPE,
        prompt,
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    } as ContentLessonExercise;
}

describe("newExtensionExerciseId", () => {
    it("is unique + prefixed", () => {
        const a = newExtensionExerciseId();
        const b = newExtensionExerciseId();
        expect(a).not.toBe(b);
        expect(a.startsWith("ex-ext-")).toBe(true);
    });
});

describe("createBlankExtensionExercise", () => {
    it("categorization blank has two empty buckets and is invalid", () => {
        const ex = createBlankExtensionExercise(CATEGORIZATION_EXT_TYPE, "c");
        expect(ex.type).toBe(CATEGORIZATION_EXT_TYPE);
        expect((ex.ext_payload as {categories: unknown[]}).categories).toHaveLength(2);
        expect(validateExtensionExercise(ex).valid).toBe(false);
    });
    it("error_correction blank has two empty tokens and is invalid", () => {
        const ex = createBlankExtensionExercise(ERROR_CORRECTION_EXT_TYPE, "e");
        expect(ex.type).toBe(ERROR_CORRECTION_EXT_TYPE);
        expect((ex.ext_payload as {tokens: unknown[]}).tokens).toHaveLength(2);
        expect(validateExtensionExercise(ex).valid).toBe(false);
    });
});

describe("validateExtensionExercise — categorization (reuses payload validator)", () => {
    it("accepts >= 2 buckets, each with >= 1 unique item", () => {
        const ex = cat({
            categories: [
                {name: "Sight", items: ["flat hand"]},
                {name: "Sound", items: ["Sit", "Down"]},
            ],
        });
        expect(validateExtensionExercise(ex).valid).toBe(true);
    });
    it("rejects fewer than 2 categories", () => {
        const res = validateExtensionExercise(
            cat({categories: [{name: "Sight", items: ["a"]}]}),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("categorization");
    });
    it("rejects an empty prompt", () => {
        const res = validateExtensionExercise(
            cat(
                {
                    categories: [
                        {name: "A", items: ["x"]},
                        {name: "B", items: ["y"]},
                    ],
                },
                "  ",
            ),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("prompt");
    });
    it("rejects an item shared across two buckets", () => {
        const res = validateExtensionExercise(
            cat({
                categories: [
                    {name: "A", items: ["dup"]},
                    {name: "B", items: ["dup"]},
                ],
            }),
        );
        expect(res.valid).toBe(false);
    });
    it("rejects a blank category name (wizard-level rule beyond the payload validator)", () => {
        const res = validateExtensionExercise(
            cat({
                categories: [
                    {name: "  ", items: ["x"]},
                    {name: "Sound", items: ["y"]},
                ],
            }),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("categorization");
    });
});

describe("validateExtensionExercise — error_correction", () => {
    it("accepts valid tokens/index/accept", () => {
        const ex = ec({
            tokens: ["The", "dog", "follow", "orders"],
            error_index: 2,
            accept: ["follows"],
        });
        expect(validateExtensionExercise(ex).valid).toBe(true);
    });
    it("rejects an out-of-range error_index", () => {
        const res = validateExtensionExercise(
            ec({tokens: ["a", "b"], error_index: 5, accept: ["x"]}),
        );
        expect(res.valid).toBe(false);
        expect(res.errorKey).toContain("error_correction");
    });
    it("rejects a correction equal to the marked token", () => {
        const res = validateExtensionExercise(
            ec({tokens: ["a", "wrong"], error_index: 1, accept: ["wrong"]}),
        );
        expect(res.valid).toBe(false);
    });
});

describe("normalizeExtensionExercise", () => {
    it("trims + drops empty categories/items", () => {
        const out = normalizeExtensionExercise(
            cat(
                {
                    categories: [
                        {name: " Sight ", items: [" flat hand ", " "]},
                        {name: "Empty", items: ["  "]},
                        {name: "Sound", items: ["Sit"]},
                    ],
                },
                "  Sort  ",
            ),
        );
        expect(out.prompt).toBe("Sort");
        const cats = (out.ext_payload as {categories: {name: string; items: string[]}[]})
            .categories;
        expect(cats).toEqual([
            {name: "Sight", items: ["flat hand"]},
            {name: "Sound", items: ["Sit"]},
        ]);
    });
    it("trims error_correction tokens in place (positional) + clamps index", () => {
        const out = normalizeExtensionExercise(
            ec({tokens: [" The ", " das "], error_index: 9, accept: [" dem ", " "]}),
        );
        const p = out.ext_payload as {
            tokens: string[];
            error_index: number;
            accept: string[];
        };
        expect(p.tokens).toEqual(["The", "das"]);
        expect(p.error_index).toBe(1);
        expect(p.accept).toEqual(["dem"]);
    });
});
