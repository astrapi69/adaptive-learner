/**
 * Tests for the reverse-mode transform (#1013): matching flips its
 * effective direction, every other type is left unchanged + flagged
 * not-reversible, and the lesson structure (steps, ids, theory) is
 * preserved without mutating the input.
 */

import {describe, expect, it} from "vitest";

import {
    isReversibleType,
    maybeReverseLesson,
    reverseExercise,
    reverseLesson,
    stepIsReversible,
} from "./reverse-lesson";
import {resolveConcreteDirection} from "../exercises/direction";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../storage/types";

function matching(
    id: string,
    direction: ContentLessonExercise["direction"] = null,
): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: "Match",
        card_ids: ["c1", "c2"],
        direction,
        pairs: [
            {left: "house", right: "Haus"},
            {left: "cat", right: "Katze"},
        ],
        distractors: [],
    };
}

function freeText(id: string): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt: "Translate: house",
        card_ids: ["c1"],
        accept: ["Haus"],
        distractors: [],
    };
}

function exerciseStep(
    id: string,
    exercise: ContentLessonExercise,
): ContentLessonStep {
    return {id, type: "exercise", exercise};
}

function theoryStep(id: string): ContentLessonStep {
    return {id, type: "theory", title: "Intro", body: "Body"};
}

describe("isReversibleType", () => {
    it("is true only for matching", () => {
        expect(isReversibleType("matching")).toBe(true);
        for (const type of [
            "cloze",
            "free_text",
            "word_tiles",
            "picture_choice",
        ] as const) {
            expect(isReversibleType(type)).toBe(false);
        }
    });
});

describe("reverseExercise", () => {
    it("flips a matching exercise's effective direction", () => {
        const ex = matching("m1");
        const original = resolveConcreteDirection(ex.direction, ex.id);
        const reversed = reverseExercise(ex);
        expect(reversed.direction).not.toBe(original);
        // Re-reversing returns to the original concrete direction.
        const back = resolveConcreteDirection(
            reverseExercise(reversed).direction,
            reversed.id,
        );
        expect(back).toBe(original);
    });

    it("flips relative to an explicitly authored direction", () => {
        const ex = matching("m2", "source_to_target");
        expect(reverseExercise(ex).direction).toBe("target_to_source");
        const ex2 = matching("m3", "target_to_source");
        expect(reverseExercise(ex2).direction).toBe("source_to_target");
    });

    it("leaves non-matching exercises unchanged (same reference)", () => {
        const ex = freeText("f1");
        expect(reverseExercise(ex)).toBe(ex);
    });

    it("does not mutate the input matching exercise", () => {
        const ex = matching("m4", "source_to_target");
        reverseExercise(ex);
        expect(ex.direction).toBe("source_to_target");
    });
});

describe("stepIsReversible", () => {
    it("is true for a matching exercise step only", () => {
        expect(stepIsReversible(exerciseStep("s1", matching("m1")))).toBe(true);
        expect(stepIsReversible(exerciseStep("s2", freeText("f1")))).toBe(
            false,
        );
        expect(stepIsReversible(theoryStep("t1"))).toBe(false);
    });
});

describe("reverseLesson", () => {
    const lesson: ContentLesson = {
        id: "lesson-1",
        title: "Lesson 1",
        estimated_minutes: 5,
        cards: [],
        steps: [
            theoryStep("t1"),
            exerciseStep("s1", matching("m1", "source_to_target")),
            exerciseStep("s2", freeText("f1")),
        ],
    };

    it("preserves step count, order, ids, and theory steps", () => {
        const reversed = reverseLesson(lesson);
        expect(reversed.steps.map((s) => s.id)).toEqual(["t1", "s1", "s2"]);
        expect(reversed.steps[0]).toEqual(lesson.steps[0]);
    });

    it("reverses matching steps and leaves the free-text step unchanged", () => {
        const reversed = reverseLesson(lesson);
        expect(reversed.steps[1].exercise?.direction).toBe("target_to_source");
        expect(reversed.steps[2].exercise).toBe(lesson.steps[2].exercise);
    });

    it("does not mutate the input lesson", () => {
        reverseLesson(lesson);
        expect(lesson.steps[1].exercise?.direction).toBe("source_to_target");
    });

    it("keeps cards and metadata untouched", () => {
        const reversed = reverseLesson(lesson);
        expect(reversed.cards).toBe(lesson.cards);
        expect(reversed.title).toBe(lesson.title);
    });
});

describe("maybeReverseLesson", () => {
    const lesson: ContentLesson = {
        id: "lesson-1",
        title: "Lesson 1",
        estimated_minutes: 5,
        cards: [],
        steps: [exerciseStep("s1", matching("m1", "source_to_target"))],
    };

    it("returns the same reference when not in reverse mode", () => {
        expect(maybeReverseLesson(lesson, "normal")).toBe(lesson);
    });

    it("reverses when in reverse mode", () => {
        const out = maybeReverseLesson(lesson, "reverse");
        expect(out).not.toBe(lesson);
        expect(out?.steps[0].exercise?.direction).toBe("target_to_source");
    });

    it("passes null through in either mode", () => {
        expect(maybeReverseLesson(null, "reverse")).toBeNull();
        expect(maybeReverseLesson(null, "normal")).toBeNull();
    });
});
