/**
 * useExplanationOutcome (#2991) - the graded outcome that drives the
 * post-answer explanation fold state, held by the exercise shell.
 *
 * A revisited step (``reviewed`` present) counts as answered from the
 * start; a new exercise (id change) starts unanswered again; a check
 * resolves to ``correct`` only when every element scored, anything less
 * is ``incorrect`` so the explanation opens expanded.
 *
 * Extracted from ``ExerciseDispatcher`` so the shell's routing function
 * stays under the complexity ratchet; the dispatcher only calls
 * ``recordScored`` from its ``onComplete`` wrapper.
 *
 * @example
 * const {outcome, recordScored} = useExplanationOutcome(exercise, reviewed);
 * <ExerciseExplanation explanation={exercise.explanation} outcome={outcome} />
 */

import {useCallback, useEffect, useState} from "react";

import type {ExplanationOutcome} from "./ExerciseExplanation";

/** The slice of ``ExerciseScored`` the fold state depends on. */
export interface ScoredCounts {
    correct: number;
    total: number;
}

function initialOutcome(reviewed: unknown): ExplanationOutcome | null {
    return reviewed != null ? "reviewed" : null;
}

/** True when every scored element was correct (a fully correct answer). */
export function isFullyCorrect(scored: ScoredCounts): boolean {
    return scored.total > 0 && scored.correct >= scored.total;
}

/**
 * Track the post-answer outcome of the exercise currently mounted in the
 * shell.
 *
 * @param exercise - The mounted exercise (its id resets the state), or null.
 * @param reviewed - The persisted answer of a revisited step, when present.
 * @returns The current outcome plus the recorder the shell calls on check.
 */
export function useExplanationOutcome(
    exercise: {id: string} | null,
    reviewed: unknown,
): {
    outcome: ExplanationOutcome | null;
    recordScored: (scored: ScoredCounts) => void;
} {
    const [outcome, setOutcome] = useState<ExplanationOutcome | null>(() =>
        initialOutcome(reviewed),
    );
    const exerciseId = exercise?.id ?? null;
    useEffect(() => {
        setOutcome(initialOutcome(reviewed));
    }, [exerciseId, reviewed]);
    const recordScored = useCallback((scored: ScoredCounts) => {
        setOutcome(isFullyCorrect(scored) ? "correct" : "incorrect");
    }, []);
    return {outcome, recordScored};
}
