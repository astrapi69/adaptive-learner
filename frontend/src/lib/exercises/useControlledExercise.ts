/**
 * useControlledExercise — the shared submit / review lifecycle for the
 * five lesson exercise renderers (FreeText, Cloze, Matching, WordTiles,
 * PictureChoice).
 *
 * Every renderer used to hand-roll the same ~60 lines: a ``submitted``
 * flag, a ``{correct, total}`` result, a guarded submit that scores the
 * answer + fires ``onComplete``, a reset, the imperative ``submit()``
 * handle the controlled (Lesson) parent drives, and the ``onInteraction``
 * effect that reports checkability. This hook owns all of that; each
 * renderer keeps only what is genuinely unique — its own answer state,
 * its ``isAnswerable`` predicate, and its ``score()`` scorer.
 *
 * The contract is unchanged, so the Lesson / Review / AdaptiveLesson
 * pages and every renderer test keep working: see
 * {@link ./../../components/exercises/exercise-control.ts}.
 */

import {useEffect, useImperativeHandle, useState, type Ref} from "react";

import type {
    ExerciseHandle,
    ExerciseScored,
} from "../../components/exercises/exercise-control";

/** The minimal post-check result a renderer displays. The full
 *  {@link ExerciseScored} (attempts + raw_answer) still flows to
 *  ``onComplete``; only this summary is kept in state. */
export interface ExerciseResult {
    correct: number;
    total: number;
}

export interface UseControlledExerciseOptions {
    /** The forwarded ref the controlled parent uses to drive submit. */
    ref: Ref<ExerciseHandle>;
    /** True in the Lesson two-phase flow (shared Check button); the
     *  renderer then hides its internal Check / retry buttons. */
    controlled: boolean;
    /** Whether the current answer is checkable. Recomputed each render;
     *  gates submit and feeds the controlled ``onInteraction`` signal. */
    isAnswerable: boolean;
    /** Controlled mode: fired whenever ``isAnswerable`` flips so the
     *  parent can enable / disable its shared "Prüfen" button. */
    onInteraction?: (answerable: boolean) => void;
    /** Fired once on a successful submit with the full scored outcome. */
    onComplete: (scored: ExerciseScored) => void;
    /** Renderer-specific scorer over its current answer state. Called at
     *  most once per submit; must not have side effects. */
    score: () => ExerciseScored;
    /** Non-null when the step is re-mounted in a locked, already-checked
     *  (reviewed) state: locks the exercise and seeds the result. */
    reviewedResult?: ExerciseResult | null;
    /** Renderer-specific answer reset (clear input, unplace tiles, …),
     *  run by {@link UseControlledExercise.reset} alongside the shared
     *  state reset. Omit when the renderer has no answer state to clear. */
    resetAnswer?: () => void;
}

export interface UseControlledExercise {
    /** True once the answer has been checked (or on a reviewed mount). */
    submitted: boolean;
    /** The post-check ``{correct, total}`` summary, or null before check. */
    result: ExerciseResult | null;
    /** Check the current answer. No-op when already submitted or the
     *  answer is not yet checkable. */
    submit: () => void;
    /** Clear the submitted state + result and run ``resetAnswer``. */
    reset: () => void;
}

/**
 * Wire a renderer's submit / review lifecycle.
 *
 * @param options - See {@link UseControlledExerciseOptions}.
 * @returns The shared {@link UseControlledExercise} state + handlers.
 */
export function useControlledExercise({
    ref,
    controlled,
    isAnswerable,
    onInteraction,
    onComplete,
    score,
    reviewedResult = null,
    resetAnswer,
}: UseControlledExerciseOptions): UseControlledExercise {
    const [submitted, setSubmitted] = useState(reviewedResult != null);
    const [result, setResult] = useState<ExerciseResult | null>(reviewedResult);

    const submit = () => {
        if (submitted || !isAnswerable) return;
        const scored = score();
        setResult({correct: scored.correct, total: scored.total});
        setSubmitted(true);
        onComplete(scored);
    };

    const reset = () => {
        setSubmitted(false);
        setResult(null);
        resetAnswer?.();
    };

    // Re-created every render (no deps) so ``submit`` closes over the
    // latest answer state, exactly as the per-renderer handles did.
    useImperativeHandle(ref, () => ({submit}));

    // Controlled mode only, and never on a reviewed / already-submitted
    // step: report the checkable state to the parent.
    useEffect(() => {
        if (!controlled || reviewedResult != null || submitted) return;
        onInteraction?.(isAnswerable);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controlled, isAnswerable, submitted]);

    return {submitted, result, submit, reset};
}
