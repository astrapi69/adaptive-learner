/**
 * generate-hint unit tests (#590).
 */

import {describe, expect, it} from "vitest";

import {formatHint, generateHints} from "./generate-hint";
import type {ContentLessonExercise} from "../../storage/types";

function ex(over: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {
        id: "e",
        type: "free_text",
        prompt: "?",
        card_ids: [],
        distractors: [],
        ...over,
    } as ContentLessonExercise;
}

describe("generateHints", () => {
    it("free_text: length then first letter", () => {
        const hints = generateHints(ex({type: "free_text", accept: ["merci"]}));
        expect(hints).toEqual([
            {level: 1, data: {kind: "length", n: 5}},
            {level: 2, data: {kind: "first_letters", prefix: "m", n: 5}},
        ]);
    });

    it("cloze: from the first blank", () => {
        const hints = generateHints(
            ex({type: "cloze", blanks: [{accept: ["der"]}]} as Partial<ContentLessonExercise>),
        );
        expect(hints[0]).toEqual({level: 1, data: {kind: "length", n: 3}});
        expect(hints[1].data).toEqual({kind: "first_letters", prefix: "d", n: 3});
    });

    it("picture_choice: eliminate a wrong option then first letter", () => {
        const hints = generateHints(
            ex({
                type: "picture_choice",
                images: [
                    {src: "a", label: "cat", is_correct: "true"},
                    {src: "b", label: "dog", is_correct: "false"},
                ],
            }),
        );
        expect(hints[0]).toEqual({level: 1, data: {kind: "not", label: "dog"}});
        expect(hints[1].data).toEqual({
            kind: "first_letters",
            prefix: "c",
            n: 3,
        });
    });

    it("matching: no hint at all (#2443 — every option is already on screen)", () => {
        // In a matching exercise both columns are fully visible. A
        // first-letter hint reveals a letter of a word the learner can
        // already read in full, and "start with X" only names a visible
        // item — neither adds information. So matching produces no hint,
        // the button never renders, and the learner is never charged XP
        // for something useless. (Follow-up to #2390, which had reduced
        // the give-away full-pair hint to this now-useless first letter.)
        expect(
            generateHints(
                ex({type: "matching", pairs: [{left: "hello", right: "hola"}]}),
            ),
        ).toEqual([]);
        expect(
            generateHints(
                ex({
                    type: "matching",
                    pairs: [
                        {left: "Auge", right: "sehen"},
                        {left: "Ohr", right: "hören"},
                    ],
                }),
            ),
        ).toEqual([]);
    });

    it("word_tiles: first word then first two words", () => {
        const hints = generateHints(
            ex({type: "word_tiles", tiles: ["I", "am", "here"]}),
        );
        expect(hints.map((h) => h.data)).toEqual([
            {kind: "item", label: "I"},
            {kind: "item", label: "I am"},
        ]);
    });

    it("returns [] when no answer can be derived", () => {
        expect(generateHints(ex({type: "free_text", accept: []}))).toEqual([]);
        expect(generateHints(ex({type: "matching", pairs: []}))).toEqual([]);
    });
});

describe("generateHints: authored exercise.hint (#3168)", () => {
    it.each([
        ["free_text", {accept: ["merci"]}],
        ["cloze", {blanks: [{accept: ["der"]}]}],
        ["word_tiles", {tiles: ["Au", "revoir"]}],
        ["ext:al-audio-tiles", {ext_payload: {audio: "a.mp3", tiles: ["Au", "revoir"]}}],
    ])("%s: the authored hint is the FIRST stage, generated ones follow", (type, over) => {
        const hints = generateHints(
            ex({type, hint: "It starts with M.", ...over} as Partial<ContentLessonExercise>),
        );
        expect(hints[0]).toEqual({
            level: 1,
            data: {kind: "authored", text: "It starts with M."},
        });
        expect(hints.length).toBeGreaterThanOrEqual(1);
        expect(hints.slice(1).every((h) => h.data.kind !== "authored")).toBe(true);
    });

    it("audio-tiles (ext:al-audio-tiles): the authored hint is the only stage", () => {
        const hints = generateHints(
            ex({
                type: "ext:al-audio-tiles",
                hint: "Two short words.",
                ext_payload: {audio: "a.mp3", tiles: ["Au", "revoir"]},
            } as Partial<ContentLessonExercise>),
        );
        expect(hints).toEqual([
            {level: 1, data: {kind: "authored", text: "Two short words."}},
        ]);
    });

    it("free_text: generated stages keep their order after the authored one", () => {
        const hints = generateHints(
            ex({type: "free_text", accept: ["merci"], hint: "Politeness."}),
        );
        expect(hints.map((h) => h.data.kind)).toEqual([
            "authored",
            "length",
            "first_letters",
        ]);
    });

    it.each([
        ["null", null],
        ["undefined", undefined],
        ["empty", ""],
        ["whitespace", "   "],
    ])("free_text: a %s authored hint adds no stage", (_label, hint) => {
        const hints = generateHints(
            ex({type: "free_text", accept: ["merci"], hint} as Partial<ContentLessonExercise>),
        );
        expect(hints.map((h) => h.data.kind)).toEqual(["length", "first_letters"]);
    });

    it("matching: an authored hint does NOT reintroduce a hint (#2443 stays)", () => {
        expect(
            generateHints(
                ex({
                    type: "matching",
                    hint: "Think about gender.",
                    pairs: [{left: "a", right: "b"}],
                } as Partial<ContentLessonExercise>),
            ),
        ).toEqual([]);
    });

    it("trims the authored hint text", () => {
        const hints = generateHints(
            ex({type: "word_tiles", tiles: ["Au", "revoir"], hint: "  Two words.  "}),
        );
        expect(hints[0].data).toEqual({kind: "authored", text: "Two words."});
    });
});

describe("formatHint", () => {
    const t = (_k: string, fallback?: string) => fallback ?? _k;
    it("formats each kind with the i18n fallback + substitutions", () => {
        expect(
            formatHint({level: 1, data: {kind: "length", n: 5}}, t),
        ).toBe("The answer has 5 letters");
        expect(
            formatHint(
                {level: 2, data: {kind: "first_letters", prefix: "m", n: 5}},
                t,
            ),
        ).toContain("m");
        expect(
            formatHint({level: 1, data: {kind: "not", label: "dog"}}, t),
        ).toContain("dog");
        expect(
            formatHint({level: 1, data: {kind: "item", label: "hola"}}, t),
        ).toContain("hola");
    });

    it("renders an authored hint verbatim, without an i18n template (#3168)", () => {
        const calls: string[] = [];
        const spy = (k: string, fallback?: string) => {
            calls.push(k);
            return fallback ?? k;
        };
        expect(
            formatHint(
                {level: 1, data: {kind: "authored", text: "Denk an className."}},
                spy,
            ),
        ).toBe("Denk an className.");
        expect(calls).toEqual([]);
    });
});
