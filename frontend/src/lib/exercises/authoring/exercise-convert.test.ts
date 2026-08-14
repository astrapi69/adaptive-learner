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
} from "./exercise-convert";
import {normalizeExerciseEdit} from "./exercise-edit";
import {elementKeysOf} from "../../srs/element-keys";
import type {ContentLessonExercise} from "../../../storage/types";

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

describe("coreConversionTargets", () => {
    it("offers free_text for the convertible core sources", () => {
        expect(coreConversionTargets(wordTiles())).toEqual(["free_text"]);
        expect(coreConversionTargets(multipleChoice())).toEqual(["free_text"]);
    });

    it("offers nothing for a non-convertible source", () => {
        expect(coreConversionTargets(base({type: "free_text"}))).toEqual([]);
        expect(
            coreConversionTargets(base({type: "matching", pairs: []})),
        ).toEqual([]);
        expect(
            coreConversionTargets(base({type: "ext:al-dictation"})),
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
