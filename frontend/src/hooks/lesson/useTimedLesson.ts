/**
 * useTimedLesson (#1009).
 *
 * Encapsulates the timed-mode orchestration so the lesson player stays
 * thin: it owns the per-question countdown length (per exercise type ×
 * difficulty + a carried correct-answer bonus), the timeout handler
 * (records the unanswered question as wrong, then auto-advances after a
 * short pause), the correct-answer bonus, and the per-question timing
 * records that feed the end-of-run stats.
 *
 * Inert unless ``enabled`` (the lesson is in timed mode): the countdown is
 * never active, no effect fires, and ``limitSeconds`` is 0 — so practice
 * and exam runs are completely unaffected.
 */

import {useCallback, useEffect, useRef, useState} from "react";

import {storedStepResult} from "../../lib/lesson/lesson-step-state";
import {
    summarizeTimedRun,
    TIMED_BONUS_SECONDS,
    TIMED_TIMEOUT_PAUSE_SECONDS,
    timeLimitSeconds,
    readTimedDifficulty,
    type ExerciseType,
    type TimedDifficulty,
    type TimedQuestionRecord,
    type TimedRunStats,
} from "../../lib/learning/timedMode";
import type {
    ContentLesson,
    ContentLessonExercise,
    LessonProgress,
    LessonStepResult,
} from "../../storage/types";

/** Wrong-answer ``total`` for a timed-out question (mirrors each renderer's
 *  own scoring): matching counts pairs, cloze counts blanks, the rest are
 *  one. */
function forcedWrongTotal(exercise: ContentLessonExercise): number {
    if (exercise.type === "matching") return exercise.pairs?.length ?? 1;
    if (exercise.type === "cloze") return exercise.blanks?.length ?? 1;
    return 1;
}

/**
 * The countdown length for the active question: the per-type × difficulty
 * limit plus the carried correct-answer bonus, or 0 when the step is not a
 * timed exercise step. Extracted so the hook computes it the same way in the
 * render-phase `limitSeconds` and the new-step `setRemaining` reset.
 *
 * @param isExerciseStep - True on an enabled, non-theory exercise step.
 * @param exercise - The active step's exercise (``null`` on a theory step).
 * @param difficulty - The run's timed difficulty.
 * @param appliedBonus - Bonus seconds carried into this question.
 */
function questionLimitSeconds(
    isExerciseStep: boolean,
    exercise: ContentLessonExercise | null,
    difficulty: TimedDifficulty,
    appliedBonus: number,
): number {
    if (!isExerciseStep || !exercise) return 0;
    return (
        timeLimitSeconds(
            exercise.type as ExerciseType,
            difficulty,
            exercise.pairs?.length ?? 1,
        ) + appliedBonus
    );
}

export interface UseTimedLessonOptions {
    enabled: boolean;
    lesson: ContentLesson | null;
    currentStepIndex: number;
    /** True once the active step's answer has been checked. */
    checked: boolean;
    progress: LessonProgress | null;
    recordStepResult: (result: LessonStepResult) => Promise<void>;
    goNext: () => void;
}

export interface UseTimedLesson {
    /** The current question's countdown length (0 when inactive). */
    limitSeconds: number;
    /** Whole seconds remaining on the current question. */
    remainingSeconds: number;
    /** True while the "time's up" message shows before auto-advance. */
    timedOut: boolean;
    /** Bonus seconds added to the CURRENT question from the previous
     *  correct answer (0 when none). Drives the "+Ns bonus" badge. */
    bonusSeconds: number;
    /** End-of-run timing summary (accumulated across the run). */
    stats: TimedRunStats;
}

/**
 * Wire the timed-mode countdown + bonus + stats for the lesson player.
 *
 * @param options - See {@link UseTimedLessonOptions}.
 */
export function useTimedLesson({
    enabled,
    lesson,
    currentStepIndex,
    checked,
    progress,
    recordStepResult,
    goNext,
}: UseTimedLessonOptions): UseTimedLesson {
    const difficultyRef = useRef(readTimedDifficulty());
    const [carriedBonus, setCarriedBonus] = useState(0);
    const [timedOut, setTimedOut] = useState(false);
    const [remaining, setRemaining] = useState(0);

    // Refs that must survive re-renders without re-triggering effects.
    const appliedBonusRef = useRef(0);
    const stepStartRef = useRef(Date.now());
    const capturedRef = useRef<Set<number>>(new Set());
    const recordsRef = useRef<TimedQuestionRecord[]>([]);
    const advanceTimerRef = useRef<number | null>(null);
    const tickRef = useRef<number | null>(null);
    const prevIndexRef = useRef(-1);

    const steps = lesson?.steps ?? null;
    const step =
        steps && currentStepIndex < steps.length
            ? steps[currentStepIndex]
            : null;
    const exercise = step?.exercise ?? null;
    const isExerciseStep =
        enabled && exercise != null && step != null && step.type !== "theory";

    const limitSeconds = questionLimitSeconds(
        isExerciseStep,
        exercise,
        difficultyRef.current,
        appliedBonusRef.current,
    );

    // Render-phase reset on a new step: snapshot the bonus EARNED so far as
    // the bonus APPLIED to this question (so earning a bonus mid-step never
    // mutates the current countdown), restart the clock, clear the
    // timed-out flag, and reset the displayed remaining.
    if (prevIndexRef.current !== currentStepIndex) {
        prevIndexRef.current = currentStepIndex;
        appliedBonusRef.current = enabled ? carriedBonus : 0;
        stepStartRef.current = Date.now();
        setTimedOut(false);
        setRemaining(
            questionLimitSeconds(
                isExerciseStep,
                exercise,
                difficultyRef.current,
                appliedBonusRef.current,
            ),
        );
        if (advanceTimerRef.current !== null) {
            window.clearTimeout(advanceTimerRef.current);
            advanceTimerRef.current = null;
        }
    }

    const handleTimeout = useCallback(() => {
        if (!enabled || step == null || exercise == null) return;
        if (capturedRef.current.has(currentStepIndex)) return;
        capturedRef.current.add(currentStepIndex);
        recordsRef.current.push({
            type: exercise.type as ExerciseType,
            seconds: limitSeconds,
            inTime: false,
        });
        // A timed-out question scores wrong; no bonus carries forward.
        setCarriedBonus(0);
        void recordStepResult({
            step_id: step.id,
            correct: 0,
            total: forcedWrongTotal(exercise),
            attempts: 1,
        });
        setTimedOut(true);
        advanceTimerRef.current = window.setTimeout(() => {
            advanceTimerRef.current = null;
            setTimedOut(false);
            goNext();
        }, TIMED_TIMEOUT_PAUSE_SECONDS * 1000);
    }, [
        enabled,
        step,
        exercise,
        currentStepIndex,
        limitSeconds,
        recordStepResult,
        goNext,
    ]);

    // The one-second countdown. Active only on an unanswered, not-timed-out
    // timed exercise step. Freezes (no tick) once the answer is checked.
    const active =
        isExerciseStep && !checked && !timedOut && limitSeconds > 0;
    const onExpireRef = useRef(handleTimeout);
    onExpireRef.current = handleTimeout;
    useEffect(() => {
        if (!active) return;
        tickRef.current = window.setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    if (tickRef.current !== null) {
                        window.clearInterval(tickRef.current);
                        tickRef.current = null;
                    }
                    onExpireRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (tickRef.current !== null) {
                window.clearInterval(tickRef.current);
                tickRef.current = null;
            }
        };
        // ``remaining`` omitted on purpose — the interval owns the decrement.
    }, [active, currentStepIndex]);

    // Capture the answered question (timing + correct-answer bonus) once the
    // result has landed in ``progress``. Guarded per step so it fires once.
    useEffect(() => {
        if (!enabled || !isExerciseStep || !checked || exercise == null) return;
        if (capturedRef.current.has(currentStepIndex)) return;
        const stored = storedStepResult(lesson, currentStepIndex, progress);
        if (!stored) return; // wait for the upsert to land
        capturedRef.current.add(currentStepIndex);
        const seconds = Math.max(
            0,
            Math.round((Date.now() - stepStartRef.current) / 1000),
        );
        recordsRef.current.push({
            type: exercise.type as ExerciseType,
            seconds,
            inTime: true,
        });
        const fullyCorrect = stored.total > 0 && stored.correct === stored.total;
        setCarriedBonus(fullyCorrect ? TIMED_BONUS_SECONDS : 0);
    }, [
        enabled,
        isExerciseStep,
        checked,
        exercise,
        lesson,
        currentStepIndex,
        progress,
    ]);

    // Tear down the pending auto-advance on unmount.
    useEffect(() => {
        return () => {
            if (advanceTimerRef.current !== null) {
                window.clearTimeout(advanceTimerRef.current);
            }
        };
    }, []);

    return {
        limitSeconds,
        remainingSeconds: remaining,
        timedOut,
        bonusSeconds: isExerciseStep ? appliedBonusRef.current : 0,
        stats: summarizeTimedRun(recordsRef.current),
    };
}
