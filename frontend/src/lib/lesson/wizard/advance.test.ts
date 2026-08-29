/**
 * lesson/wizard/advance tests (#2773) — the four-flow "Next" cascade as a
 * value table, one row per branch of the former ``handleNext``.
 */

import {describe, expect, it} from "vitest";

import {
    decideNextStep,
    type AdvanceDecision,
    type AdvanceDeps,
    type AdvanceInput,
} from "./advance";

function input(over: Partial<AdvanceInput>): AdvanceInput {
    return {
        step: 1,
        flow: "standard",
        metaValid: true,
        editMode: false,
        bookLessonCount: 0,
        cardCount: 0,
        minCards: 3,
        exerciseCount: 0,
        totalSteps: 4,
        ...over,
    };
}

function deps(over: Partial<AdvanceDeps> = {}): AdvanceDeps {
    return {
        minExercisesToAdvance: () => 3,
        hasIncompleteExercise: () => false,
        hasInvalidExtensionExercise: () => false,
        ...over,
    };
}

describe("decideNextStep (#2773)", () => {
    it.each<[string, Partial<AdvanceInput>, Partial<AdvanceDeps>, AdvanceDecision]>([
        [
            "step1-missing-title-flags-in-every-flow",
            {step: 1, flow: "book", metaValid: false},
            {},
            {kind: "flag-title"},
        ],
        [
            "step1-valid-title-advances",
            {step: 1},
            {},
            {kind: "advance", nextStep: 2},
        ],
        [
            "book-step2-without-generated-lessons-blocks",
            {step: 2, flow: "book", bookLessonCount: 0, totalSteps: 3},
            {},
            {kind: "exercise-error"},
        ],
        [
            "book-step2-with-a-lesson-advances-capped-at-3",
            {step: 3, flow: "book", bookLessonCount: 1, totalSteps: 3},
            {},
            {kind: "advance", nextStep: 3},
        ],
        [
            "extension-step2-empty-blocks",
            {step: 2, flow: "extension", exerciseCount: 0, totalSteps: 3},
            {},
            {kind: "exercise-error"},
        ],
        [
            "extension-step2-invalid-payload-blocks",
            {step: 2, flow: "extension", exerciseCount: 2, totalSteps: 3},
            {hasInvalidExtensionExercise: () => true},
            {kind: "exercise-error"},
        ],
        [
            "extension-step2-valid-advances",
            {step: 2, flow: "extension", exerciseCount: 2, totalSteps: 3},
            {},
            {kind: "advance", nextStep: 3},
        ],
        [
            "cardless-edit-step2-below-floor-blocks",
            {step: 2, flow: "cardless-edit", exerciseCount: 0, totalSteps: 3},
            {minExercisesToAdvance: () => 1},
            {kind: "exercise-error"},
        ],
        [
            "cardless-edit-step2-incomplete-blocks",
            {step: 2, flow: "cardless-edit", exerciseCount: 2, totalSteps: 3},
            {minExercisesToAdvance: () => 1, hasIncompleteExercise: () => true},
            {kind: "exercise-error"},
        ],
        [
            "cardless-edit-step2-ok-advances",
            {step: 2, flow: "cardless-edit", exerciseCount: 2, totalSteps: 3},
            {minExercisesToAdvance: () => 1},
            {kind: "advance", nextStep: 3},
        ],
        [
            "standard-step2-too-few-cards-blocks-on-create",
            {step: 2, cardCount: 2, minCards: 3},
            {},
            {kind: "card-error"},
        ],
        [
            "standard-step2-card-minimum-waived-on-edit",
            {step: 2, cardCount: 0, editMode: true},
            {},
            {kind: "advance", nextStep: 3},
        ],
        [
            "standard-step3-too-few-exercises-blocks",
            {step: 3, exerciseCount: 2},
            {},
            {kind: "exercise-error"},
        ],
        [
            "standard-step3-incomplete-exercise-blocks-even-on-edit",
            {step: 3, exerciseCount: 5, editMode: true},
            {minExercisesToAdvance: () => 1, hasIncompleteExercise: () => true},
            {kind: "exercise-error"},
        ],
        [
            "standard-step3-ok-advances",
            {step: 3, exerciseCount: 5},
            {},
            {kind: "advance", nextStep: 4},
        ],
        [
            "advance-caps-at-the-flow-total",
            {step: 4, exerciseCount: 5},
            {},
            {kind: "advance", nextStep: 4},
        ],
    ])("%s", (_id, inputOver, depsOver, expected) => {
        expect(decideNextStep(input(inputOver), deps(depsOver))).toEqual(expected);
    });
});
