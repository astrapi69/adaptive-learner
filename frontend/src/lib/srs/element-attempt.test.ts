/**
 * Tests for the per-exercise-type element-attempt derivers
 * (Phase 46B / C9 / P-129).
 *
 * Pins the D2 derivation rules for every exercise type:
 * one attempt per matching pair (the only fan-out type),
 * single attempt for the other three, correct vs wrong
 * detection, element_key = canonical content, element_type
 * heuristic.
 */

import {describe, expect, it} from "vitest";

import {
    deriveCategorizationAttempts,
    deriveErrorCorrectionAttempt,
    deriveClozeAttempts,
    deriveClozeMultiSelectAttempt,
    deriveFreeTextAttempt,
    deriveMatchingAttempts,
    derivePictureChoiceAttempt,
    deriveWordTilesAttempt,
    type AttemptContext,
} from "./element-attempt";
import type {ContentLessonExercise} from "../../storage/types";

const CTX: AttemptContext = {
    setId: "language-fr-a1",
    lessonId: "01-greetings.json",
};

// --- MATCHING --------------------------------------------------------------

describe("deriveMatchingAttempts", () => {
    const exercise: ContentLessonExercise = {
        id: "ex-match",
        type: "matching",
        prompt: "Match",
        card_ids: [],
        pairs: [
            {left: "Bonjour", right: "Hello"},
            {left: "Merci", right: "Thank you"},
            {left: "Au revoir", right: "Goodbye"},
        ],
        distractors: [],
    };

    it("produces one attempt per pair", () => {
        const matches = new Map<number, number>([
            [0, 0],
            [1, 1],
            [2, 2],
        ]);
        const attempts = deriveMatchingAttempts(exercise, CTX, matches);
        expect(attempts).toHaveLength(3);
        expect(attempts.every((a) => a.exercise_id === "ex-match")).toBe(true);
        expect(attempts.every((a) => a.set_id === "language-fr-a1")).toBe(true);
    });

    it("element_key for each attempt is the pair.left text", () => {
        const matches = new Map([[0, 0]]);
        const attempts = deriveMatchingAttempts(exercise, CTX, matches);
        expect(attempts.map((a) => a.element_key)).toEqual([
            "Bonjour",
            "Merci",
            "Au revoir",
        ]);
    });

    it("flags every pair correct when matches map is identity", () => {
        const matches = new Map([
            [0, 0],
            [1, 1],
            [2, 2],
        ]);
        const attempts = deriveMatchingAttempts(exercise, CTX, matches);
        expect(attempts.every((a) => a.correct)).toBe(true);
    });

    it("flags mismatched pairs as wrong + records the user's pairing text", () => {
        // User paired Bonjour with the right at originalIdx=1 = "Thank you"
        const matches = new Map([
            [0, 1], // Bonjour ↔ Thank you (wrong)
            [1, 0], // Merci ↔ Hello (wrong)
            [2, 2], // Au revoir ↔ Goodbye (correct)
        ]);
        const attempts = deriveMatchingAttempts(exercise, CTX, matches);
        expect(attempts[0].correct).toBe(false);
        expect(attempts[0].user_answer).toBe("Thank you");
        expect(attempts[0].correct_answer).toBe("Hello");
        expect(attempts[1].correct).toBe(false);
        expect(attempts[1].user_answer).toBe("Hello");
        expect(attempts[2].correct).toBe(true);
        expect(attempts[2].user_answer).toBe("Goodbye");
    });

    it("flags an unpaired left as wrong with empty user_answer", () => {
        const matches = new Map([[0, 0]]); // only Bonjour paired
        const attempts = deriveMatchingAttempts(exercise, CTX, matches);
        expect(attempts[1].correct).toBe(false);
        expect(attempts[1].user_answer).toBe("");
        expect(attempts[2].correct).toBe(false);
        expect(attempts[2].user_answer).toBe("");
    });

    it("element_type is vocabulary for every matching attempt", () => {
        const matches = new Map([[0, 0]]);
        const attempts = deriveMatchingAttempts(exercise, CTX, matches);
        expect(attempts.every((a) => a.element_type === "vocabulary")).toBe(
            true,
        );
    });

    it("empty pairs yields empty attempts", () => {
        const empty: ContentLessonExercise = {...exercise, pairs: []};
        expect(deriveMatchingAttempts(empty, CTX, new Map())).toEqual([]);
    });
});

// --- PICTURE_CHOICE --------------------------------------------------------

describe("derivePictureChoiceAttempt", () => {
    const exercise: ContentLessonExercise = {
        id: "ex-pic",
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

    it("element_key is the correct image's label", () => {
        const attempt = derivePictureChoiceAttempt(exercise, CTX, 1);
        expect(attempt.element_key).toBe("Dog");
        expect(attempt.correct_answer).toBe("Dog");
    });

    it("correct=true when the user picked the is_correct tile", () => {
        const attempt = derivePictureChoiceAttempt(exercise, CTX, 1);
        expect(attempt.correct).toBe(true);
        expect(attempt.user_answer).toBe("Dog");
    });

    it("correct=false when the user picked a wrong tile + records their pick", () => {
        const attempt = derivePictureChoiceAttempt(exercise, CTX, 0);
        expect(attempt.correct).toBe(false);
        expect(attempt.user_answer).toBe("Cat");
        // element_key still points at the CORRECT label so reviews
        // re-target the same concept.
        expect(attempt.element_key).toBe("Dog");
    });

    it("element_type is vocabulary", () => {
        const attempt = derivePictureChoiceAttempt(exercise, CTX, 0);
        expect(attempt.element_type).toBe("vocabulary");
    });

    it("defensively returns empty element_key + correct=false when no image is marked correct", () => {
        const broken: ContentLessonExercise = {
            ...exercise,
            images: [
                {src: "a.png", label: "Cat"},
                {src: "b.png", label: "Dog"},
            ],
        };
        const attempt = derivePictureChoiceAttempt(broken, CTX, 0);
        expect(attempt.element_key).toBe("");
        expect(attempt.correct).toBe(false);
    });
});

// --- FREE_TEXT -------------------------------------------------------------

describe("deriveFreeTextAttempt", () => {
    const exercise: ContentLessonExercise = {
        id: "ex-free",
        type: "free_text",
        prompt: "Type it",
        card_ids: [],
        accept: ["Merci", "merci"],
        distractors: [],
    };

    it("element_key is accept[0] (canonical)", () => {
        const attempt = deriveFreeTextAttempt(exercise, CTX, "merci", true);
        expect(attempt.element_key).toBe("Merci");
        expect(attempt.correct_answer).toBe("Merci");
    });

    it("records user_input as user_answer regardless of correctness", () => {
        const wrong = deriveFreeTextAttempt(exercise, CTX, "bonjour", false);
        expect(wrong.user_answer).toBe("bonjour");
        expect(wrong.correct).toBe(false);
    });

    it("element_type is vocabulary", () => {
        const a = deriveFreeTextAttempt(exercise, CTX, "x", false);
        expect(a.element_type).toBe("vocabulary");
    });

    it("defensively returns empty element_key when accept is missing", () => {
        const broken: ContentLessonExercise = {
            ...exercise,
            accept: null,
        };
        const a = deriveFreeTextAttempt(broken, CTX, "x", false);
        expect(a.element_key).toBe("");
    });
});

// --- WORD_TILES ------------------------------------------------------------

describe("deriveWordTilesAttempt", () => {
    const exercise: ContentLessonExercise = {
        id: "ex-tiles",
        type: "word_tiles",
        prompt: "Arrange",
        card_ids: [],
        tiles: ["Au", "revoir"],
        distractors: [],
    };

    it("element_key is tiles.join(' ') canonical", () => {
        const a = deriveWordTilesAttempt(exercise, CTX, [0, 1], true);
        expect(a.element_key).toBe("Au revoir");
        expect(a.correct_answer).toBe("Au revoir");
    });

    it("user_answer is placedOrder mapped through tiles + space-joined", () => {
        const wrong = deriveWordTilesAttempt(exercise, CTX, [1, 0], false);
        expect(wrong.user_answer).toBe("revoir Au");
        expect(wrong.correct).toBe(false);
    });

    it("element_type is grammar_rule for multi-tile (ordering = grammar)", () => {
        const a = deriveWordTilesAttempt(exercise, CTX, [0, 1], true);
        expect(a.element_type).toBe("grammar_rule");
    });

    it("element_type falls back to vocabulary for single-tile edge case", () => {
        const single: ContentLessonExercise = {
            ...exercise,
            tiles: ["Bonjour"],
        };
        const a = deriveWordTilesAttempt(single, CTX, [0], true);
        expect(a.element_type).toBe("vocabulary");
    });

    it("defensively returns empty when tiles is missing", () => {
        const broken: ContentLessonExercise = {...exercise, tiles: null};
        const a = deriveWordTilesAttempt(broken, CTX, [], false);
        expect(a.element_key).toBe("");
        expect(a.user_answer).toBe("");
    });
});

// --- CLOZE (Phase 52D / v1.35.0 / P-127) ----------------------------------

describe("deriveClozeAttempts", () => {
    const exercise: ContentLessonExercise = {
        id: "ex-cloze",
        type: "cloze",
        prompt: "Fill in",
        card_ids: [],
        sentence: "J'ai ___ ami et ___ amie.",
        blanks: [
            {accept: ["un"]},
            {accept: ["une"]},
        ],
        distractors: [],
    };

    it("emits one ElementAttempt per blank in order", () => {
        const attempts = deriveClozeAttempts(
            exercise,
            CTX,
            ["un", "une"],
            [true, true],
        );
        expect(attempts).toHaveLength(2);
        expect(attempts[0].element_key).toBe("un");
        expect(attempts[1].element_key).toBe("une");
    });

    it("element_key = blank's canonical (accept[0])", () => {
        const ex2: ContentLessonExercise = {
            ...exercise,
            blanks: [{accept: ["un", "Un", "UN"]}],
            sentence: "Je vois ___ chat.",
        };
        const attempts = deriveClozeAttempts(ex2, CTX, ["un"], [true]);
        expect(attempts[0].element_key).toBe("un");
    });

    it("propagates correctness per blank from perBlankCorrect", () => {
        const attempts = deriveClozeAttempts(
            exercise,
            CTX,
            ["un", "le"],
            [true, false],
        );
        expect(attempts[0].correct).toBe(true);
        expect(attempts[1].correct).toBe(false);
    });

    it("propagates user_answer per blank", () => {
        const attempts = deriveClozeAttempts(
            exercise,
            CTX,
            ["x", "y"],
            [false, false],
        );
        expect(attempts[0].user_answer).toBe("x");
        expect(attempts[1].user_answer).toBe("y");
    });

    it("element_type defaults to vocabulary", () => {
        const attempts = deriveClozeAttempts(
            exercise,
            CTX,
            ["un", "une"],
            [true, true],
        );
        expect(attempts[0].element_type).toBe("vocabulary");
        expect(attempts[1].element_type).toBe("vocabulary");
    });

    it("defensively returns empty when blanks is missing", () => {
        const broken: ContentLessonExercise = {
            ...exercise,
            blanks: null,
        };
        const attempts = deriveClozeAttempts(broken, CTX, [], []);
        expect(attempts).toEqual([]);
    });

    it("fills missing per-blank input with empty string", () => {
        // perBlankInputs shorter than blanks (partial fill, shouldn't
        // happen in practice because the renderer waits for all
        // blanks, but pin the defensive behaviour).
        const attempts = deriveClozeAttempts(
            exercise,
            CTX,
            ["un"],
            [true],
        );
        expect(attempts[1].user_answer).toBe("");
        expect(attempts[1].correct).toBe(false);
    });
});

// --- CLOZE MULTISELECT (#1195) ---------------------------------------------

describe("deriveClozeMultiSelectAttempt", () => {
    const exercise: ContentLessonExercise = {
        id: "ex-ms",
        type: "cloze",
        cloze_mode: "multiselect",
        prompt: "Select all that apply.",
        card_ids: [],
        sentence: "Which cities are in Germany?",
        accept: ["Berlin", "Hamburg"],
        distractors: ["Vienna", "Zurich"],
    };

    it("uses the sorted accept set as canonical element_key + correct_answer", () => {
        const attempt = deriveClozeMultiSelectAttempt(
            exercise,
            CTX,
            ["Hamburg", "Berlin"],
            true,
        );
        expect(attempt.element_key).toBe("Berlin, Hamburg");
        expect(attempt.correct_answer).toBe("Berlin, Hamburg");
        // user_answer is the chosen set, sorted for a stable string.
        expect(attempt.user_answer).toBe("Berlin, Hamburg");
        expect(attempt.correct).toBe(true);
        expect(attempt.set_id).toBe("language-fr-a1");
        expect(attempt.exercise_id).toBe("ex-ms");
    });

    it("records the chosen set verbatim (sorted) on a wrong attempt", () => {
        const attempt = deriveClozeMultiSelectAttempt(
            exercise,
            CTX,
            ["Vienna"],
            false,
        );
        expect(attempt.user_answer).toBe("Vienna");
        expect(attempt.correct).toBe(false);
    });
});


describe("deriveCategorizationAttempts", () => {
    // #1579 - adopted extension ext:al-categorization: one attempt per item,
    // element_key = the item, mirrors the matching fan-out.
    const exercise = {
        id: "ex-categ-01",
        type: "ext:al-categorization",
        prompt: "Ordne zu.",
        card_ids: [],
        distractors: [],
        ext_payload: {
            categories: [
                {name: "Sichtzeichen", items: ["flache Hand"]},
                {name: "Hoerzeichen", items: ["Sitz", "Platz"]},
            ],
        },
    } as unknown as ContentLessonExercise;
    const ctx = {setId: "set-1", lessonId: "lesson-1"};

    it("fans out one attempt per authored item with the chosen bucket", () => {
        const attempts = deriveCategorizationAttempts(
            exercise,
            ctx,
            new Map([
                ["flache Hand", "Sichtzeichen"],
                ["Sitz", "Sichtzeichen"],
                ["Platz", "Hoerzeichen"],
            ]),
        );
        expect(attempts).toHaveLength(3);
        const bySitz = attempts.find((a) => a.element_key === "Sitz");
        expect(bySitz).toMatchObject({
            set_id: "set-1",
            lesson_id: "lesson-1",
            exercise_id: "ex-categ-01",
            element_type: "vocabulary",
            user_answer: "Sichtzeichen",
            correct_answer: "Hoerzeichen",
            correct: false,
        });
        const byPlatz = attempts.find((a) => a.element_key === "Platz");
        expect(byPlatz).toMatchObject({correct: true, user_answer: "Hoerzeichen"});
    });

    it("an unassigned item counts as a wrong attempt with an empty user answer", () => {
        const attempts = deriveCategorizationAttempts(
            exercise,
            ctx,
            new Map([["flache Hand", "Sichtzeichen"]]),
        );
        const unassigned = attempts.find((a) => a.element_key === "Sitz");
        expect(unassigned).toMatchObject({correct: false, user_answer: ""});
    });

    it("a malformed payload yields no attempts (edge)", () => {
        const broken = {
            ...exercise,
            ext_payload: {categories: "nope"},
        } as unknown as ContentLessonExercise;
        expect(deriveCategorizationAttempts(broken, ctx, new Map())).toEqual([]);
    });
});


describe("deriveErrorCorrectionAttempt", () => {
    // #1579 second adoption - ext:al-error-correction: one attempt per
    // exercise (one grammar decision), element_key = the canonical
    // correction accept[0], element_type grammar_rule.
    const exercise = {
        id: "ex-errcorr-01",
        type: "ext:al-error-correction",
        prompt: "Ein Wort ist falsch.",
        card_ids: [],
        distractors: [],
        ext_payload: {
            tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
            error_index: 3,
            accept: ["dem", "einem"],
        },
    } as unknown as ContentLessonExercise;
    const ctx = {setId: "set-1", lessonId: "lesson-1"};

    it("derives one grammar_rule attempt keyed by the canonical correction", () => {
        const attempt = deriveErrorCorrectionAttempt(
            exercise,
            ctx,
            {pickedIndex: 3, typedCorrection: "einem"},
            true,
        );
        expect(attempt).toMatchObject({
            set_id: "set-1",
            lesson_id: "lesson-1",
            exercise_id: "ex-errcorr-01",
            element_key: "dem",
            element_type: "grammar_rule",
            user_answer: "das -> einem",
            correct_answer: "das -> dem",
            correct: true,
        });
    });

    it("records a wrong pick with the picked token in the user answer", () => {
        const attempt = deriveErrorCorrectionAttempt(
            exercise,
            ctx,
            {pickedIndex: 2, typedCorrection: "dem"},
            false,
        );
        expect(attempt).toMatchObject({
            user_answer: "folgt -> dem",
            correct: false,
        });
    });
});
