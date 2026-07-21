import {describe, expect, it} from "vitest";

import {
    correctOptionTexts,
    isMultipleChoiceCorrect,
} from "./multiple-choice-grading";

/**
 * Grading contract for the native multiple_choice type (schema v1.6,
 * engine 0.8.1): single = the one picked option is the correct one;
 * multiple = exact-set match over the correct options, NO partial credit
 * (mirrors the cloze multiselect contract).
 */

const OPTIONS = [
    {text: "Wer von rechts kommt", correct: true},
    {text: "Wer von links kommt"},
    {text: "Das groessere Fahrzeug"},
];

const MULTI_OPTIONS = [
    {text: "2", correct: true},
    {text: "3", correct: true},
    {text: "4"},
    {text: "5", correct: true},
];

describe("correctOptionTexts", () => {
    it("returns the texts of the correct options", () => {
        expect(correctOptionTexts(MULTI_OPTIONS)).toEqual(["2", "3", "5"]);
    });
});

describe("isMultipleChoiceCorrect - single (multiple: false)", () => {
    it("accepts the single correct pick", () => {
        expect(
            isMultipleChoiceCorrect(["Wer von rechts kommt"], OPTIONS, false),
        ).toBe(true);
    });

    it("rejects a wrong pick", () => {
        expect(
            isMultipleChoiceCorrect(["Wer von links kommt"], OPTIONS, false),
        ).toBe(false);
    });

    it("rejects an empty selection", () => {
        expect(isMultipleChoiceCorrect([], OPTIONS, false)).toBe(false);
    });

    it("rejects two picks even when one is the correct one", () => {
        expect(
            isMultipleChoiceCorrect(
                ["Wer von rechts kommt", "Wer von links kommt"],
                OPTIONS,
                false,
            ),
        ).toBe(false);
    });
});

describe("isMultipleChoiceCorrect - select all (multiple: true)", () => {
    it("accepts the exact correct set (order-independent)", () => {
        expect(
            isMultipleChoiceCorrect(["5", "2", "3"], MULTI_OPTIONS, true),
        ).toBe(true);
    });

    it("rejects a partial selection (missing one correct) - no partial credit", () => {
        expect(isMultipleChoiceCorrect(["2", "3"], MULTI_OPTIONS, true)).toBe(
            false,
        );
    });

    it("rejects a superset (a wrong option added)", () => {
        expect(
            isMultipleChoiceCorrect(["2", "3", "4", "5"], MULTI_OPTIONS, true),
        ).toBe(false);
    });

    it("rejects an empty selection", () => {
        expect(isMultipleChoiceCorrect([], MULTI_OPTIONS, true)).toBe(false);
    });

    it("normalises unicode + whitespace before comparing (NFC + trim)", () => {
        const accented = [{text: "café", correct: true}, {text: "tee"}];
        expect(
            isMultipleChoiceCorrect(["café "], accented, true),
        ).toBe(true);
    });
});
