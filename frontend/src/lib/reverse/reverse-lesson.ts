/**
 * reverseLesson — the Rückwärts-Modus exercise transform (#1013).
 *
 * Reverse mode (``cardDirection: "reverse"`` in MODE_CONFIGS) flips the
 * question/answer direction of a lesson's exercises in place — same lesson,
 * same steps, same step ids, just the drill direction inverted.
 *
 * Only **matching** has a deterministic, gradeable reversal the existing
 * renderers already support: the EXP-018 ``direction`` field drives
 * MatchingExercise's column flip (definition -> term), and the SRS
 * attempt-deriver stamps that same direction, so a reversed matching
 * exercise is graded and tracked correctly with zero renderer changes.
 *
 * The other four types have no gradeable structural reversal that can be
 * derived from the stored content without an AI step — a free-text
 * "formulate a fitting question" or a cloze "complete the surrounding
 * sentence" cannot be graded deterministically, a word-tiles "identify the
 * key terms" needs a term annotation that isn't authored, and a
 * picture-choice "pick the term" needs a text-multiple-choice renderer that
 * does not exist. Per the issue's own rule, those play in their original
 * format and are flagged not-reversible (the player shows a
 * "(not reversible)" note). So reverse mode never produces an ungradeable or
 * mis-rendered exercise.
 *
 * Pure + deterministic: the matching flip is keyed by the exercise id via
 * {@link resolveConcreteDirection}, and the input is never mutated.
 *
 * @example
 * const reversed = reverseLesson(lesson);
 * // matching steps now drill the opposite direction; other steps unchanged.
 */

import {
    resolveConcreteDirection,
    type ConcreteDirection,
} from "../exercises/direction";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../storage/types";

/** The opposite concrete drill direction. */
function flipDirection(direction: ConcreteDirection): ConcreteDirection {
    return direction === "target_to_source"
        ? "source_to_target"
        : "target_to_source";
}

/**
 * Whether an exercise type has a gradeable, renderer-supported reversal.
 * Only matching qualifies (see the module docstring); every other type
 * shows the "(not reversible)" note and plays unchanged.
 *
 * @param type - The {@link ContentLessonExercise.type}.
 */
export function isReversibleType(
    type: ContentLessonExercise["type"],
): boolean {
    return type === "matching";
}

/**
 * Whether a lesson step is an exercise step whose type can be reversed.
 * Theory steps and non-matching exercise steps return ``false`` (the
 * player draws the "(not reversible)" note for the latter).
 *
 * @param step - A {@link ContentLessonStep}.
 */
export function stepIsReversible(step: ContentLessonStep): boolean {
    return (
        step.type === "exercise" &&
        step.exercise != null &&
        isReversibleType(step.exercise.type)
    );
}

/**
 * Reverse one exercise. Matching gets its effective direction flipped (the
 * column flip the renderer + SRS already honor); every other type is
 * returned unchanged. Never mutates the input.
 *
 * @param exercise - The exercise to reverse.
 * @returns A new exercise (matching) or the same reference (other types).
 */
export function reverseExercise(
    exercise: ContentLessonExercise,
): ContentLessonExercise {
    if (exercise.type !== "matching") return exercise;
    const flipped = flipDirection(
        resolveConcreteDirection(exercise.direction, exercise.id),
    );
    return {...exercise, direction: flipped};
}

/**
 * Reverse every exercise step of a lesson, preserving step order, ids, and
 * theory steps. The lesson's cards and metadata are untouched.
 *
 * @param lesson - The lesson to transform.
 * @returns A new lesson with reversed exercise steps.
 */
export function reverseLesson(lesson: ContentLesson): ContentLesson {
    return {
        ...lesson,
        steps: lesson.steps.map((step) =>
            step.type === "exercise" && step.exercise
                ? {...step, exercise: reverseExercise(step.exercise)}
                : step,
        ),
    };
}
