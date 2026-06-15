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

    it("matching: an item then a revealed pair", () => {
        const hints = generateHints(
            ex({type: "matching", pairs: [{left: "hello", right: "hola"}]}),
        );
        expect(hints[0]).toEqual({level: 1, data: {kind: "item", label: "hello"}});
        expect(hints[1]).toEqual({
            level: 2,
            data: {kind: "reveal_pair", left: "hello", right: "hola"},
        });
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
            formatHint(
                {level: 2, data: {kind: "reveal_pair", left: "a", right: "b"}},
                t,
            ),
        ).toContain("b");
    });
});
