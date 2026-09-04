/**
 * Tests for the lesson combo reducer (#2874): pure streak
 * arithmetic - correct answers grow the combo, a wrong answer
 * breaks it, the best value survives the break.
 */

import {describe, expect, it} from "vitest";

import {
    COMBO_VISIBLE_FROM,
    comboAfterAnswer,
    initialCombo,
} from "./combo";

describe("combo reducer", () => {
    it("starts at zero", () => {
        expect(initialCombo()).toEqual({current: 0, best: 0, bonusEligible: 0});
    });

    it.each([
        ["one correct", [true], {current: 1, best: 1, bonusEligible: 0}],
        ["three in a row", [true, true, true], {current: 3, best: 3, bonusEligible: 1}],
        [
            "a wrong answer breaks the run but keeps the best",
            [true, true, true, false],
            {current: 0, best: 3, bonusEligible: 1},
        ],
        [
            "a new run can beat the old best",
            [true, true, false, true, true, true],
            {current: 3, best: 3, bonusEligible: 1},
        ],
        [
            "a shorter new run keeps the earlier best",
            [true, true, true, false, true],
            {current: 1, best: 3, bonusEligible: 1},
        ],
        ["wrong first answer stays zero", [false], {current: 0, best: 0, bonusEligible: 0}],
    ])("%s", (_name, answers, expected) => {
        let state = initialCombo();
        for (const correct of answers) {
            state = comboAfterAnswer(state, correct);
        }
        expect(state).toEqual(expected);
    });

    it("becomes visible from two in a row", () => {
        expect(COMBO_VISIBLE_FROM).toBe(2);
    });
});


describe("combo bonus counter (#2893)", () => {
    it.each([
        ["no streak", [true, false, true], 0],
        ["streak of exactly 3 earns one", [true, true, true], 1],
        ["streak of 5 earns three", [true, true, true, true, true], 3],
        [
            "broken and rebuilt streaks accumulate",
            [true, true, true, false, true, true, true, true],
            3,
        ],
        ["wrong answers never reset the earned counter", [true, true, true, false], 1],
    ])("%s", (_label, answers: boolean[], expected: number) => {
        let state = initialCombo();
        for (const correct of answers) {
            state = comboAfterAnswer(state, correct);
        }
        expect(state.bonusEligible).toBe(expected);
    });
});
