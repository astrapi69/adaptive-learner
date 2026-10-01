/**
 * Tests for the exercise-edit normalizer and helpers (#1844).
 *
 * These pin the normalizer that trims + drops empty entries before the
 * edit is committed to the exercise record. Whether a draft is saveable is
 * ``checkExerciseDraft``'s call (#3387), pinned in
 * ``lib/content/lesson/exercise-draft-check.test.ts``. Pure functions, no
 * React.
 */

import {describe, expect, it} from "vitest";

import {
    countClozeMarkers,
    createBlankExercise,
    newExerciseId,
    normalizeExerciseEdit,
} from "./exercise-edit";
import type {ContentLessonExercise} from "../../../storage/types";

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

// adaptive-learner-content fa435fe, sets/de/ja-a0/lessons/01-vokale.json
const multiselect = base({
    id: "ex-ms-vok",
    type: "cloze",
    cloze_mode: "multiselect",
    prompt: "Wähle alle fünf Vokal-Zeichen.",
    sentence: "Welche dieser Zeichen sind Vokale?",
    accept: ["あ", "い", "う", "え", "お"],
    distractors: ["か", "さ", "な"],
});

describe("normalizeExerciseEdit — cloze multiselect (#3246)", () => {
    // A "select all that apply" cloze has no ___ markers and no blanks by
    // design: its sentence IS the question, accept holds the correct
    // options, distractors the wrong ones.
    it("does not add blanks to a multiselect cloze", () => {
        expect(normalizeExerciseEdit(multiselect)).not.toHaveProperty("blanks");
    });
    it("drops a stray blanks array from a multiselect cloze", () => {
        const out = normalizeExerciseEdit({...multiselect, blanks: [{accept: ["x"]}]});
        expect(out).not.toHaveProperty("blanks");
        expect(out.accept).toEqual(multiselect.accept);
    });
    it("keeps cloze_mode, accept and distractors as given (trimmed, non-empty)", () => {
        const out = normalizeExerciseEdit({
            ...multiselect,
            accept: [" あ", "い ", ""],
            distractors: ["か", " "],
        });
        expect(out.cloze_mode).toBe("multiselect");
        expect(out.accept).toEqual(["あ", "い"]);
        expect(out.distractors).toEqual(["か"]);
    });
    it.each([
        ["padded", "  Welche sind Vokale? ", "Welche sind Vokale?"],
        ["blank", "   ", ""],
    ])("trims a %s question like the prompt (#3387)", (_name, sentence, expected) => {
        expect(normalizeExerciseEdit({...multiselect, sentence}).sentence).toBe(expected);
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

describe("explanation on the core editor (#2992)", () => {
    it("trims the explanation on normalize", () => {
        const out = normalizeExerciseEdit(
            base({accept: ["hello"], explanation: "  **Regel:** hinten.\n\n"}),
        );
        expect(out.explanation).toBe("**Regel:** hinten.");
    });

    it.each([
        ["blank", "   "],
        ["empty", ""],
        ["null", null],
    ])("drops a %s explanation key entirely", (_label, value) => {
        const out = normalizeExerciseEdit(
            base({accept: ["hello"], explanation: value as string | null}),
        );
        expect("explanation" in out).toBe(false);
    });

    it("leaves an exercise without the key untouched", () => {
        const out = normalizeExerciseEdit(base({accept: ["hello"]}));
        expect("explanation" in out).toBe(false);
    });

    it("keeps the explanation across every type-specific normalizer", () => {
        const cloze = normalizeExerciseEdit(
            base({
                type: "cloze",
                sentence: "el ___ rojo",
                blanks: [{accept: [" coche "]}],
                explanation: "**Regel:** hinten.",
            }),
        );
        expect(cloze.explanation).toBe("**Regel:** hinten.");
        expect(cloze.blanks).toEqual([{accept: ["coche"]}]);
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

    it("builds a blank of each type with an empty prompt", () => {
        for (const type of TYPES) {
            const ex = createBlankExercise(type, `id-${type}`);
            expect(ex.type).toBe(type);
            expect(ex.id).toBe(`id-${type}`);
            // The empty prompt alone keeps every blank out until it is
            // filled (pinned against checkExerciseDraft, #3387).
            expect(ex.prompt).toBe("");
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
