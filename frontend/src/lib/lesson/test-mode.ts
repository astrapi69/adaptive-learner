/**
 * Test mode (#2319): a preview-only state that lets someone click through a
 * lesson WITHOUT knowing the content, to verify device flows (navigation,
 * layout, focus, iOS standalone).
 *
 * Two rules make it safe:
 *   - it exists ONLY when the build sets ``VITE_TEST_MODE`` (default off), so
 *     the regular build cannot enter it and it is switchable off once real
 *     users arrive;
 *   - while active every answer is accepted as correct and NO progress is
 *     written - the progress-write path skips its writes, and the exercise
 *     lifecycle coerces the displayed result via {@link forceCorrect}.
 *
 * This module holds only the pure, side-effect-free helpers; the React state
 * + provider live in ``hooks/lesson/modes/useTestMode``.
 */

import type {ExerciseScored} from "../../components/exercises/shell/exercise-control";

/** True only in a build that opted in via ``VITE_TEST_MODE`` (``"true"`` /
 *  ``"1"``). Unset - the default for the regular and current GH-Pages builds -
 *  is false, so test mode is not reachable there at all. */
export function isTestModeAvailable(): boolean {
    const raw = String(import.meta.env.VITE_TEST_MODE ?? "").toLowerCase();
    return raw === "true" || raw === "1";
}

/** Rewrite a scored outcome so it counts as fully correct: the aggregate hits
 *  ``total`` and every element attempt is marked correct. Used by the shared
 *  exercise lifecycle so, in test mode, any answer the learner gives reads as
 *  right - "no evaluation", not "guess the right answer". The returned object
 *  is a copy; the input is not mutated. */
export function forceCorrect(scored: ExerciseScored): ExerciseScored {
    return {
        ...scored,
        correct: scored.total,
        attempts: scored.attempts.map((attempt) => ({
            ...attempt,
            correct: true,
        })),
    };
}
