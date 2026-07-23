/**
 * Tests for the extension blank-factory + validation (#1852).
 */

import {describe, expect, it} from "vitest";

import {
    CATEGORIZATION_EXT_TYPE,
    DICTATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
    createBlankExtensionExercise,
    newExtensionExerciseId,
    normalizeExtensionExercise,
    validateExtensionExercise,
} from "./extension-edit";
import type {ContentLessonExercise} from "../../../storage/types";

function rc(payload: unknown, prompt = "Read + answer"): ContentLessonExercise {
    return {
        id: "r1",
        type: READING_COMPREHENSION_EXT_TYPE,
        prompt,
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    } as ContentLessonExercise;
}
function gq(payload: unknown, prompt = "Answer the quiz"): ContentLessonExercise {
    return {
        id: "q1",
        type: GRADED_QUIZ_EXT_TYPE,
        prompt,
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    } as ContentLessonExercise;
}

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
function dict(payload: unknown, prompt = "Type what you hear"): ContentLessonExercise {
    return {
        id: "d1",
        type: DICTATION_EXT_TYPE,
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
    it("reading_comprehension blank has an empty passage + one question and is invalid", () => {
        const ex = createBlankExtensionExercise(READING_COMPREHENSION_EXT_TYPE, "r");
        expect(ex.type).toBe(READING_COMPREHENSION_EXT_TYPE);
        const p = ex.ext_payload as {passage: string; questions: unknown[]};
        expect(p.passage).toBe("");
        expect(p.questions).toHaveLength(1);
        expect(validateExtensionExercise(ex).valid).toBe(false);
    });
    it("dictation blank has an empty audio + no accept and is invalid", () => {
        const ex = createBlankExtensionExercise(DICTATION_EXT_TYPE, "d");
        expect(ex.type).toBe(DICTATION_EXT_TYPE);
        expect(ex.ext_payload).toEqual({audio: "", accept: []});
        expect(validateExtensionExercise(ex).valid).toBe(false);
    });
    it("graded_quiz blank has a threshold + one question with points and is invalid", () => {
        const ex = createBlankExtensionExercise(GRADED_QUIZ_EXT_TYPE, "q");
        expect(ex.type).toBe(GRADED_QUIZ_EXT_TYPE);
        const p = ex.ext_payload as {
            pass_threshold: number;
            questions: {points: number}[];
        };
        expect(p.pass_threshold).toBe(60);
        expect(p.questions[0].points).toBe(1);
        expect(validateExtensionExercise(ex).valid).toBe(false);
    });
});

describe("validateExtensionExercise — reading_comprehension", () => {
    const valid = {
        passage: "Rex ran into the garden and barked.",
        questions: [
            {
                prompt: "Where did Rex run?",
                type: "multiple_choice",
                options: [
                    {text: "The garden", correct: true},
                    {text: "The street"},
                ],
            },
            {prompt: "The dog's name?", type: "free_text", accept: ["Rex"]},
        ],
    };
    it("accepts a well-formed passage + questions", () => {
        expect(validateExtensionExercise(rc(valid)).valid).toBe(true);
    });
    it("rejects an empty passage", () => {
        const res = validateExtensionExercise(rc({...valid, passage: "   "}));
        expect(res.valid).toBe(false);
        expect(res.code).toBe("reading_comprehension");
    });
    it("rejects a multiple_choice question with no correct option", () => {
        const res = validateExtensionExercise(
            rc({
                passage: "text",
                questions: [
                    {
                        prompt: "q",
                        type: "multiple_choice",
                        options: [{text: "a"}, {text: "b"}],
                    },
                ],
            }),
        );
        expect(res.valid).toBe(false);
    });
    it("rejects a free_text question with no accepted answer", () => {
        const res = validateExtensionExercise(
            rc({
                passage: "text",
                questions: [{prompt: "q", type: "free_text", accept: []}],
            }),
        );
        expect(res.valid).toBe(false);
    });
});

describe("validateExtensionExercise — graded_quiz", () => {
    const valid = {
        pass_threshold: 60,
        questions: [
            {
                prompt: "2+2?",
                type: "multiple_choice",
                options: [{text: "4", correct: true}, {text: "5"}],
                points: 2,
            },
            {prompt: "Synonym for fast?", type: "free_text", accept: ["quick"], points: 3},
        ],
    };
    it("accepts a well-formed quiz", () => {
        expect(validateExtensionExercise(gq(valid)).valid).toBe(true);
    });
    it("rejects a non-positive points value", () => {
        const res = validateExtensionExercise(
            gq({
                questions: [
                    {
                        prompt: "q",
                        type: "multiple_choice",
                        options: [{text: "a", correct: true}, {text: "b"}],
                        points: 0,
                    },
                ],
            }),
        );
        expect(res.valid).toBe(false);
        expect(res.code).toBe("graded_quiz");
    });
    it("rejects an out-of-range pass_threshold", () => {
        const res = validateExtensionExercise(gq({...valid, pass_threshold: 140}));
        expect(res.valid).toBe(false);
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
        expect(res.code).toBe("categorization");
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
        expect(res.code).toBe("prompt");
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
        expect(res.code).toBe("categorization");
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
        expect(res.code).toBe("error_correction");
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
    it("reading_comprehension: trims passage + drops the unused question branch", () => {
        const out = normalizeExtensionExercise(
            rc(
                {
                    passage: "  A passage.  ",
                    questions: [
                        {
                            prompt: "  q1  ",
                            type: "multiple_choice",
                            options: [
                                {text: " A ", correct: true},
                                {text: "", correct: false},
                                {text: "B", correct: false},
                            ],
                            accept: ["leftover"],
                        },
                        {
                            prompt: "q2",
                            type: "free_text",
                            options: [{text: "x", correct: true}],
                            accept: [" Rex ", "  "],
                        },
                    ],
                },
                "  Read  ",
            ),
        );
        expect(out.prompt).toBe("Read");
        const p = out.ext_payload as {passage: string; questions: unknown[]};
        expect(p.passage).toBe("A passage.");
        expect(p.questions[0]).toEqual({
            prompt: "q1",
            type: "multiple_choice",
            options: [
                {text: "A", correct: true},
                {text: "B", correct: false},
            ],
        });
        expect(p.questions[1]).toEqual({
            prompt: "q2",
            type: "free_text",
            accept: ["Rex"],
        });
    });
    it("graded_quiz: carries points + partial_credit, drops the unused branch", () => {
        const out = normalizeExtensionExercise(
            gq({
                pass_threshold: 70,
                questions: [
                    {
                        prompt: "q1",
                        type: "multiple_choice",
                        options: [
                            {text: "a", correct: true},
                            {text: "b", correct: true},
                        ],
                        accept: ["x"],
                        points: 4,
                        partial_credit: true,
                    },
                ],
            }),
        );
        const p = out.ext_payload as {
            pass_threshold: number;
            questions: Record<string, unknown>[];
        };
        expect(p.pass_threshold).toBe(70);
        expect(p.questions[0]).toEqual({
            prompt: "q1",
            type: "multiple_choice",
            options: [
                {text: "a", correct: true},
                {text: "b", correct: true},
            ],
            points: 4,
            partial_credit: true,
        });
    });
    it("dictation: trims the audio path + drops empty accept entries", () => {
        const out = normalizeExtensionExercise(
            dict(
                {audio: "  assets/audio/one.mp3  ", accept: [" un ", "", "  "]},
                "  Listen  ",
            ),
        );
        expect(out.prompt).toBe("Listen");
        expect(out.ext_payload).toEqual({
            audio: "assets/audio/one.mp3",
            accept: ["un"],
        });
    });
});

describe("validateExtensionExercise — dictation (reuses payload validator)", () => {
    it("accepts a non-empty audio path + >= 1 accept entry", () => {
        const ex = dict({audio: "assets/audio/one.mp3", accept: ["un"]});
        expect(validateExtensionExercise(ex).valid).toBe(true);
    });
    it("rejects an empty prompt", () => {
        const res = validateExtensionExercise(
            dict({audio: "assets/audio/one.mp3", accept: ["un"]}, "   "),
        );
        expect(res.valid).toBe(false);
        expect(res.code).toBe("prompt");
    });
    it("rejects a missing/empty audio path", () => {
        const res = validateExtensionExercise(dict({audio: "  ", accept: ["un"]}));
        expect(res.valid).toBe(false);
        expect(res.code).toBe("dictation");
    });
    it("rejects an empty accept list", () => {
        const res = validateExtensionExercise(
            dict({audio: "assets/audio/one.mp3", accept: []}),
        );
        expect(res.valid).toBe(false);
        expect(res.code).toBe("dictation");
    });
});
