/**
 * reverseLesson — the Rückwärts-Modus exercise transform (#1013).
 *
 * Reverse mode (``cardDirection: "reverse"`` in MODE_CONFIGS) flips the
 * question/answer direction of a lesson's exercises in place — same lesson,
 * same steps, same step ids, just the drill direction inverted.
 *
 * Two types have a deterministic, gradeable reversal the existing renderers
 * already play:
 *   - **matching** — the EXP-018 ``direction`` field drives
 *     MatchingExercise's column flip (definition -> term), and the SRS
 *     attempt-deriver stamps that same direction; zero renderer changes.
 *   - **cloze** — the original answer becomes visible context and a context
 *     word becomes the new blank ({@link reverseCloze}); the unmodified
 *     ClozeExercise renders it and the SRS records a real attempt.
 *
 * The other three types have no gradeable structural reversal derivable from
 * the stored content without an AI step — a free-text "formulate a fitting
 * question" cannot be graded, a word-tiles "identify the key terms" needs a
 * term annotation that isn't authored, and a picture-choice "pick the term"
 * needs a text-multiple-choice renderer that does not exist. Per the issue's
 * own rule, those play in their original format and are flagged
 * not-reversible (the player shows a "(not reversible)" note). So reverse
 * mode never produces an ungradeable or mis-rendered exercise.
 *
 * Pure + deterministic: the matching flip is keyed by the exercise id via
 * {@link resolveConcreteDirection}, the cloze reversal by the longest
 * context word, and the input is never mutated.
 *
 * @example
 * const reversed = reverseLesson(lesson);
 * // matching steps now drill the opposite direction; other steps unchanged.
 */

import {
    resolveConcreteDirection,
    type ConcreteDirection,
} from "../exercises/direction";
import {reverseCloze} from "./reverse-cloze";
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
 * Matching and cloze qualify (see the module docstring); every other type
 * shows the "(not reversible)" note and plays unchanged.
 *
 * @param type - The {@link ContentLessonExercise.type}.
 */
export function isReversibleType(
    type: ContentLessonExercise["type"],
): boolean {
    return type === "matching" || type === "cloze";
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
 * column flip the renderer + SRS already honor); cloze gets re-blanked
 * (answer shown, a context word becomes the gap); every other type — and a
 * cloze with no gradeable reversal — is returned unchanged. Never mutates
 * the input.
 *
 * @param exercise - The exercise to reverse.
 * @returns A new exercise (matching / cloze) or the same reference.
 */
export function reverseExercise(
    exercise: ContentLessonExercise,
): ContentLessonExercise {
    if (exercise.type === "matching") {
        const flipped = flipDirection(
            resolveConcreteDirection(exercise.direction, exercise.id),
        );
        return {...exercise, direction: flipped};
    }
    if (exercise.type === "cloze") {
        return reverseCloze(exercise) ?? exercise;
    }
    return exercise;
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

/**
 * The lesson to actually play for a given card direction: the reversed
 * lesson in reverse mode, the original otherwise. Null-tolerant so the
 * lesson player can call it before the lesson has loaded — which keeps the
 * mode branch out of the player component (cohesion).
 *
 * @param lesson - The loaded lesson, or ``null`` while loading.
 * @param direction - The active mode's ``cardDirection``.
 * @returns The lesson to play (same reference when not reversing), or
 *   ``null`` when ``lesson`` is ``null``.
 */
export function maybeReverseLesson(
    lesson: ContentLesson | null,
    direction: "normal" | "reverse",
): ContentLesson | null {
    if (!lesson || direction !== "reverse") return lesson;
    return reverseLesson(lesson);
}
