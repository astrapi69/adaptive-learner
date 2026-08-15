/**
 * Tests for the Stage-1 exercise type conversion (EXP-050, #2511).
 *
 * Pin the two key-preserving ``-> free_text`` conversions: the field mapping
 * (content carried into ``accept``, wrong options into ``distractors``), the
 * ``extra="forbid"`` clean field swap (source fields dropped), the survival
 * of the exercise identity (``id`` / ``stable_id``), and — the wound point of
 * EXP-050 — that the SRS element key does not move
 * ({@link conversionPreservesElementKeys}). Pure functions, no React.
 */

import {describe, expect, it} from "vitest";

import {
    conversionPreservesElementKeys,
    convertExercise,
    coreConversionTargets,
    extensionConversionTargets,
} from "./exercise-convert";
import {normalizeExerciseEdit, validateExerciseEdit} from "./exercise-edit";
import {validateExtensionExercise} from "./extension-edit";
import {elementKeysOf} from "../../srs/element-keys";
import type {ContentLessonExercise} from "../../../storage/types";

const GQ = "ext:al-graded-quiz";
const RC = "ext:al-reading-comprehension";

function base(over: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {
        id: "ex-1",
        type: "free_text",
        prompt: "Prompt",
        card_ids: [],
        distractors: [],
        ...over,
    } as ContentLessonExercise;
}

const wordTiles = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "word_tiles",
        prompt: "Arrange the sentence",
        tiles: ["Je", "suis", "ici"],
        ...over,
    });

const multipleChoice = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "multiple_choice",
        prompt: "Pick the translation",
        multiple: false,
        options: [
            {text: "danke", correct: true},
            {text: "bitte", correct: false},
            {text: "hallo", correct: false},
        ],
        ...over,
    });

const dictation = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "ext:al-dictation",
        prompt: "Write what you hear",
        ext_payload: {audio: "assets/audio/clip.mp3", accept: ["bonjour", "Bonjour"]},
        ...over,
    });

const imageDescription = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "ext:al-image-description",
        prompt: "Describe the picture",
        ext_payload: {image: "data:image/png;base64,AAAA", accept: ["a cat", "cat"]},
        ...over,
    });

const errorCorrection = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "ext:al-error-correction",
        prompt: "Fix the wrong word",
        ext_payload: {
            tokens: ["Je", "suit", "ici"],
            error_index: 1,
            accept: ["suis"],
        },
        ...over,
    });

const clozeSingle = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "cloze",
        prompt: "Fill the blank",
        sentence: "Je ___ ici",
        cloze_mode: "select",
        blanks: [{accept: ["suis"]}],
        ...over,
    });

const clozeMulti = (over: Partial<ContentLessonExercise> = {}) =>
    base({
        type: "cloze",
        prompt: "Fill the blanks",
        sentence: "Je ___ ___ ici",
        cloze_mode: "type",
        blanks: [{accept: ["suis"]}, {accept: ["vraiment"]}],
        ...over,
    });

describe("coreConversionTargets", () => {
    it("offers free_text for the convertible core sources", () => {
        expect(coreConversionTargets(wordTiles())).toEqual(["free_text"]);
        expect(coreConversionTargets(multipleChoice())).toEqual(["free_text"]);
        expect(coreConversionTargets(clozeSingle())).toEqual(["free_text"]);
        expect(coreConversionTargets(clozeMulti())).toEqual(["free_text"]);
    });

    it("offers the completion targets for a free_text source (Stage 3)", () => {
        expect(coreConversionTargets(base({type: "free_text"}))).toEqual([
            "multiple_choice",
            "cloze",
        ]);
    });

    it("does not offer conversion for a multiselect cloze", () => {
        expect(
            coreConversionTargets(
                clozeSingle({cloze_mode: "multiselect", accept: ["a", "b"]}),
            ),
        ).toEqual([]);
    });

    it("offers nothing for a non-convertible source", () => {
        expect(
            coreConversionTargets(base({type: "matching", pairs: []})),
        ).toEqual([]);
        expect(
            coreConversionTargets(base({type: "ext:al-dictation"})),
        ).toEqual([]);
    });
});

describe("extensionConversionTargets", () => {
    it("offers free_text for the convertible extension sources", () => {
        expect(extensionConversionTargets(dictation())).toEqual(["free_text"]);
        expect(extensionConversionTargets(imageDescription())).toEqual([
            "free_text",
        ]);
        expect(extensionConversionTargets(errorCorrection())).toEqual([
            "free_text",
        ]);
    });

    it("offers nothing for a core source or a non-convertible extension", () => {
        expect(extensionConversionTargets(wordTiles())).toEqual([]);
        expect(
            extensionConversionTargets(
                base({type: "ext:al-categorization", ext_payload: {}}),
            ),
        ).toEqual([]);
    });
});

describe("convertExercise — word_tiles -> free_text", () => {
    it("carries the tiles into accept[0] as the joined sentence", () => {
        const out = convertExercise(wordTiles(), "free_text");
        expect(out.type).toBe("free_text");
        expect(out.accept).toEqual(["Je suis ici"]);
    });

    it("drops the source-type field so extra=forbid stays clean", () => {
        const out = convertExercise(wordTiles(), "free_text");
        expect("tiles" in out).toBe(false);
    });

    it("keeps the exercise identity (id + stable_id)", () => {
        const out = convertExercise(
            wordTiles({id: "ex-9", stable_id: "wt-stable-01"}),
            "free_text",
        );
        expect(out.id).toBe("ex-9");
        expect(out.stable_id).toBe("wt-stable-01");
    });

    it("preserves the SRS element key (no orphaning)", () => {
        const src = wordTiles();
        expect(conversionPreservesElementKeys(src, convertExercise(src, "free_text"))).toBe(
            true,
        );
    });
});

describe("convertExercise — multiple_choice -> free_text", () => {
    it("uses the correct option as the accepted answer", () => {
        const out = convertExercise(multipleChoice(), "free_text");
        expect(out.type).toBe("free_text");
        expect(out.accept).toEqual(["danke"]);
    });

    it("moves the wrong options into distractors", () => {
        const out = convertExercise(multipleChoice(), "free_text");
        expect(out.distractors).toEqual(["bitte", "hallo"]);
    });

    it("joins several correct options in sorted order, matching the key rule", () => {
        const src = multipleChoice({
            multiple: true,
            options: [
                {text: "danke", correct: true},
                {text: "bitte", correct: true},
                {text: "hallo", correct: false},
            ],
        });
        const out = convertExercise(src, "free_text");
        expect(out.accept).toEqual(["bitte, danke"]);
        expect(out.distractors).toEqual(["hallo"]);
    });

    it("drops the source-type fields (options + multiple)", () => {
        const out = convertExercise(multipleChoice(), "free_text");
        expect("options" in out).toBe(false);
        expect("multiple" in out).toBe(false);
    });

    it("preserves the SRS element key (single and multiple)", () => {
        const single = multipleChoice();
        const multi = multipleChoice({
            multiple: true,
            options: [
                {text: "danke", correct: true},
                {text: "bitte", correct: true},
                {text: "hallo", correct: false},
            ],
        });
        expect(
            conversionPreservesElementKeys(single, convertExercise(single, "free_text")),
        ).toBe(true);
        expect(
            conversionPreservesElementKeys(multi, convertExercise(multi, "free_text")),
        ).toBe(true);
    });
});

describe("convertExercise — ext:al-dictation -> free_text", () => {
    it("lifts the tolerated transcriptions from ext_payload into accept", () => {
        const out = convertExercise(dictation(), "free_text");
        expect(out.type).toBe("free_text");
        expect(out.accept).toEqual(["bonjour", "Bonjour"]);
    });

    it("drops ext_payload so extra=forbid stays clean", () => {
        const out = convertExercise(dictation(), "free_text");
        expect("ext_payload" in out).toBe(false);
    });

    it("keeps the exercise identity and preserves the element key", () => {
        const src = dictation({id: "d-7", stable_id: "dict-stable-7"});
        const out = convertExercise(src, "free_text");
        expect(out.id).toBe("d-7");
        expect(out.stable_id).toBe("dict-stable-7");
        // dictation key = first non-empty accept; free_text key = accept[0].
        expect(conversionPreservesElementKeys(src, out)).toBe(true);
    });
});

describe("convertExercise — ext:al-image-description -> free_text", () => {
    it("lifts the accepted answers from ext_payload and drops the image", () => {
        const out = convertExercise(imageDescription(), "free_text");
        expect(out.type).toBe("free_text");
        expect(out.accept).toEqual(["a cat", "cat"]);
        expect("ext_payload" in out).toBe(false);
    });

    it("preserves the element key", () => {
        const src = imageDescription();
        expect(
            conversionPreservesElementKeys(src, convertExercise(src, "free_text")),
        ).toBe(true);
    });
});

describe("convertExercise — ext:al-error-correction -> free_text", () => {
    it("lifts the accepted correction into accept and drops ext_payload", () => {
        const out = convertExercise(errorCorrection(), "free_text");
        expect(out.type).toBe("free_text");
        expect(out.accept).toEqual(["suis"]);
        expect("ext_payload" in out).toBe(false);
    });

    it("preserves the element key (EC key IS accept[0])", () => {
        const src = errorCorrection();
        expect(
            conversionPreservesElementKeys(src, convertExercise(src, "free_text")),
        ).toBe(true);
    });
});

describe("convertExercise — cloze -> free_text", () => {
    it("carries a single blank's accepts and preserves the key", () => {
        const out = convertExercise(clozeSingle(), "free_text");
        expect(out.type).toBe("free_text");
        expect(out.accept).toEqual(["suis"]);
        expect("sentence" in out).toBe(false);
        expect("blanks" in out).toBe(false);
        expect("cloze_mode" in out).toBe(false);
        expect(
            conversionPreservesElementKeys(clozeSingle(), out),
        ).toBe(true);
    });

    it("MOVES the key for a multi-blank cloze (N -> 1)", () => {
        const src = clozeMulti();
        const out = convertExercise(src, "free_text");
        expect(out.accept).toEqual(["suis"]); // only the first blank carries
        // Source has 2 element keys, free_text has 1 -> not preserved.
        expect(elementKeysOf(normalizeExerciseEdit(src))).toHaveLength(2);
        expect(conversionPreservesElementKeys(src, out)).toBe(false);
    });
});

describe("convertExercise — free_text -> multiple_choice (Stage 3 completion)", () => {
    const freeText = (over: Partial<ContentLessonExercise> = {}) =>
        base({type: "free_text", prompt: "Translate", accept: ["danke"], ...over});

    it("makes the accepted answer the single correct option + one empty slot", () => {
        const out = convertExercise(freeText(), "multiple_choice");
        expect(out.type).toBe("multiple_choice");
        expect(out.multiple).toBe(false);
        expect(out.options).toEqual([
            {text: "danke", correct: true},
            {text: "", correct: false},
        ]);
        expect("accept" in out).toBe(false);
    });

    it("seeds wrong options from the free_text distractors when present", () => {
        const out = convertExercise(
            freeText({distractors: ["bitte", "hallo"]}),
            "multiple_choice",
        );
        expect(out.options).toEqual([
            {text: "danke", correct: true},
            {text: "bitte", correct: false},
            {text: "hallo", correct: false},
        ]);
        expect(out.distractors).toEqual([]);
    });

    it("leaves an incomplete draft (Save-blocked) when there are no distractors", () => {
        const out = convertExercise(freeText(), "multiple_choice");
        // The empty second option keeps the multiple-choice validator failing.
        expect(validateExerciseEdit(out).valid).toBe(false);
    });

    it("is valid once a distractor seeds a second option", () => {
        const out = convertExercise(
            freeText({distractors: ["bitte"]}),
            "multiple_choice",
        );
        expect(validateExerciseEdit(out).valid).toBe(true);
    });

    it("preserves the element key (the one correct option = accept[0])", () => {
        const src = freeText();
        expect(
            conversionPreservesElementKeys(src, convertExercise(src, "multiple_choice")),
        ).toBe(true);
    });
});

describe("convertExercise — free_text -> cloze (Stage 3 completion)", () => {
    const freeText = () => base({type: "free_text", prompt: "Fill in", accept: ["suis"]});

    it("builds a single ___ blank carrying the accepted answer", () => {
        const out = convertExercise(freeText(), "cloze");
        expect(out.type).toBe("cloze");
        expect(out.sentence).toBe("___");
        expect(out.cloze_mode).toBe("type");
        expect(out.blanks).toEqual([{accept: ["suis"]}]);
        expect("accept" in out).toBe(false);
    });

    it("is a valid starter cloze and preserves the element key", () => {
        const src = freeText();
        const out = convertExercise(src, "cloze");
        expect(validateExerciseEdit(out).valid).toBe(true);
        expect(conversionPreservesElementKeys(src, out)).toBe(true);
    });
});

describe("convertExercise — graded-quiz <-> reading-comprehension (Stage 3b)", () => {
    const gq = (over: Partial<ContentLessonExercise> = {}) =>
        base({
            type: GQ,
            prompt: "Quiz",
            ext_payload: {
                pass_threshold: 60,
                questions: [
                    {
                        prompt: "Q1",
                        type: "multiple_choice",
                        options: [
                            {text: "a", correct: true},
                            {text: "b", correct: false},
                        ],
                        points: 2,
                    },
                    {prompt: "Q2", type: "free_text", accept: ["x"], points: 1},
                ],
            },
            ...over,
        });

    const rc = (over: Partial<ContentLessonExercise> = {}) =>
        base({
            type: RC,
            prompt: "Read",
            ext_payload: {
                passage: "Some passage.",
                questions: [
                    {
                        prompt: "Q1",
                        type: "multiple_choice",
                        options: [
                            {text: "a", correct: true},
                            {text: "b", correct: false},
                        ],
                    },
                    {prompt: "Q2", type: "free_text", accept: ["x"]},
                ],
            },
            ...over,
        });

    it("offers the paired ext target both ways", () => {
        expect(extensionConversionTargets(gq())).toEqual([RC]);
        expect(extensionConversionTargets(rc())).toEqual([GQ]);
    });

    it("graded-quiz -> reading-comprehension: strips points, starts an empty passage", () => {
        const out = convertExercise(gq(), RC as "free_text");
        expect(out.type).toBe(RC);
        const payload = out.ext_payload as {passage: string; questions: unknown[]};
        expect(payload.passage).toBe("");
        expect(payload.questions).toHaveLength(2);
        expect(payload.questions.every((q) => !("points" in (q as object)))).toBe(true);
        // Empty passage -> RC validator blocks Save.
        expect(validateExtensionExercise(out).valid).toBe(false);
    });

    it("reading-comprehension -> graded-quiz: drops passage, weights each question (valid)", () => {
        const out = convertExercise(rc(), GQ as "free_text");
        expect(out.type).toBe(GQ);
        const payload = out.ext_payload as {
            pass_threshold: number;
            questions: {points: number}[];
        };
        expect("passage" in payload).toBe(false);
        expect(payload.questions.every((q) => q.points === 1)).toBe(true);
        expect(validateExtensionExercise(out).valid).toBe(true);
    });

    it("preserves the element key for single-correct MC + free_text questions", () => {
        expect(
            conversionPreservesElementKeys(gq(), convertExercise(gq(), RC as "free_text")),
        ).toBe(true);
        expect(
            conversionPreservesElementKeys(rc(), convertExercise(rc(), GQ as "free_text")),
        ).toBe(true);
    });

    it("MOVES the key when an MC question has several correct options", () => {
        const multi = gq({
            ext_payload: {
                pass_threshold: 60,
                questions: [
                    {
                        prompt: "Q1",
                        type: "multiple_choice",
                        options: [
                            {text: "a", correct: true},
                            {text: "b", correct: true},
                        ],
                        points: 1,
                    },
                ],
            },
        });
        // GQ key joins the correct set ("a, b"); RC key is the first correct ("a").
        expect(
            conversionPreservesElementKeys(multi, convertExercise(multi, RC as "free_text")),
        ).toBe(false);
    });
});

describe("convertExercise — robustness", () => {
    it("normalizes untrimmed content so the key still matches", () => {
        const src = wordTiles({tiles: ["  Je ", "suis", " ici "]});
        const out = convertExercise(src, "free_text");
        // The saved word_tiles key is derived from the trimmed tiles, so the
        // converted accept[0] must equal that exact string.
        const srcKey = elementKeysOf(normalizeExerciseEdit(src));
        expect(out.accept?.[0]).toBe(srcKey?.[0]);
        expect(conversionPreservesElementKeys(src, out)).toBe(true);
    });

    it("returns the exercise unchanged for a non-free_text target and non-convertible source", () => {
        const ft = base({type: "free_text", accept: ["x"]});
        expect(convertExercise(ft, "free_text")).toBe(ft);
    });
});
