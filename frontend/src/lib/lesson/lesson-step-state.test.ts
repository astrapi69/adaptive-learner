/**
 * #2600 — adopted ``ext:al-*`` exercises must gate the two-phase
 * Check/Next button exactly like core types. The dispatcher renders
 * core ∪ adopted-ext (``ExerciseDispatcher``), so the step predicate
 * has to agree — a renderable exercise that the footer treats as a
 * theory step is playable-but-never-graded.
 */

import {describe, expect, it} from "vitest";

import {SUPPORTED_EXT_EXERCISE_TYPES} from "../../components/exercises";
import {isPlayableExerciseStep} from "./lesson-step-state";
import type {ContentLessonStep} from "../../storage/types";

function exerciseStep(exerciseType: string): ContentLessonStep {
    return {
        id: "step-1",
        type: "exercise",
        title: null,
        exercise: {
            id: "ex-1",
            type: exerciseType,
            prompt: "Prompt",
            card_ids: ["card-1"],
        },
    } as ContentLessonStep;
}

describe("isPlayableExerciseStep", () => {
    it("returns true for every adopted ext: exercise type (#2600)", () => {
        for (const extType of SUPPORTED_EXT_EXERCISE_TYPES) {
            expect(isPlayableExerciseStep(exerciseStep(extType)), extType).toBe(
                true,
            );
        }
    });

    it("returns true for a core exercise type", () => {
        expect(isPlayableExerciseStep(exerciseStep("matching"))).toBe(true);
        expect(isPlayableExerciseStep(exerciseStep("free_text"))).toBe(true);
    });

    it("returns false for a non-adopted ext: type (placeholder stays plain Next)", () => {
        expect(isPlayableExerciseStep(exerciseStep("ext:vendor-foo"))).toBe(
            false,
        );
        expect(isPlayableExerciseStep(exerciseStep("unknown_type"))).toBe(false);
    });

    it("returns false for theory, missing exercise, and null", () => {
        const theory = {
            id: "t-1",
            type: "theory",
            title: "t",
            body: "b",
        } as ContentLessonStep;
        const noExercise = {
            id: "s-1",
            type: "exercise",
            title: null,
        } as ContentLessonStep;
        expect(isPlayableExerciseStep(theory)).toBe(false);
        expect(isPlayableExerciseStep(noExercise)).toBe(false);
        expect(isPlayableExerciseStep(null)).toBe(false);
    });
});
