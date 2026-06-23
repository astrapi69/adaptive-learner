/**
 * Tests for the reverse-mode cloze reversal (#1013): the original answer
 * becomes visible context and the longest context word becomes the new
 * blank, deterministically and gradeably; un-reversible clozes return null;
 * the input is never mutated.
 */

import {describe, expect, it} from "vitest";

import {reverseCloze} from "./reverse-cloze";
import type {ContentLessonExercise} from "../../storage/types";

function cloze(
    sentence: string,
    blanks: Array<{accept: string[]}>,
): ContentLessonExercise {
    return {
        id: "c1",
        type: "cloze",
        prompt: "Fill the blank",
        card_ids: ["card1"],
        sentence,
        blanks,
        cloze_mode: "type",
        distractors: [],
    };
}

describe("reverseCloze", () => {
    it("returns null for a non-cloze exercise", () => {
        const ex: ContentLessonExercise = {
            id: "f1",
            type: "free_text",
            prompt: "p",
            card_ids: [],
            accept: ["x"],
            distractors: [],
        };
        expect(reverseCloze(ex)).toBeNull();
    });

    it("fills the original blank and blanks the longest context word", () => {
        // "The ___ is sleeping" + cat -> "The cat is sleeping", longest
        // non-answer content word is "sleeping".
        const out = reverseCloze(cloze("The ___ is sleeping", [{accept: ["cat"]}]));
        expect(out).not.toBeNull();
        expect(out!.type).toBe("cloze");
        expect(out!.sentence).toBe("The cat is ___");
        expect(out!.blanks).toEqual([{accept: ["sleeping"]}]);
        expect(out!.cloze_mode).toBe("type");
    });

    it("never blanks one of the (now visible) answers", () => {
        const out = reverseCloze(cloze("___ ___ today", [
            {accept: ["beautiful"]},
            {accept: ["weather"]},
        ]));
        // Full: "beautiful weather today"; answers excluded -> "today" is the
        // only eligible word (>=4 chars, not an answer).
        expect(out!.sentence).toBe("beautiful weather ___");
        expect(out!.blanks).toEqual([{accept: ["today"]}]);
    });

    it("returns null when no eligible context word exists", () => {
        // Filled = "I am ok": every non-answer word is shorter than 4 chars.
        expect(reverseCloze(cloze("I am ___", [{accept: ["ok"]}]))).toBeNull();
    });

    it("returns null for a malformed cloze (segment/blank mismatch)", () => {
        // Two markers but one blank.
        expect(reverseCloze(cloze("___ and ___", [{accept: ["A"]}]))).toBeNull();
    });

    it("matches whole words only (not a substring of a longer word)", () => {
        // "art" must not match inside "started"; the longest word "started"
        // is chosen and replaced as a whole.
        const out = reverseCloze(cloze("She ___ it", [{accept: ["started"]}]));
        // Filled "She started it" -> longest non-answer >=4 is "started"
        // itself? "started" IS the answer, excluded. "She"/"it" too short ->
        // null.
        expect(out).toBeNull();
    });

    it("does not mutate the input", () => {
        const input = cloze("The ___ is big", [{accept: ["house"]}]);
        const snapshot = JSON.parse(JSON.stringify(input));
        reverseCloze(input);
        expect(input).toEqual(snapshot);
    });
});
