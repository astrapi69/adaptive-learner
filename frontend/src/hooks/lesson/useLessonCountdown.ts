/**
 * useLessonCountdown (#2878) - the game-mode per-exercise countdown.
 *
 * A tension garnish, NOT a lesson mode: while enabled it counts a
 * configurable number of seconds per exercise step. Expiry counts as
 * one failed try for the tension layer - it emits a single
 * wrong-answer celebration (streak breaks, a heart falls, the mascot
 * reacts, the wrong tone plays) - but it never auto-submits, never
 * advances, and never touches scoring or SRS: the learner keeps
 * solving the step at leisure.
 *
 * Distinct from the TIMED lesson mode (``useTimedLesson``), which is
 * its own mode with per-type limits, a forced wrong RECORD on timeout
 * and auto-advance. The caller keeps this hook disabled in timed and
 * exam lessons and on the summary.
 */

import {useEffect, useRef, useState} from "react";

import {emitCelebration} from "../../lib/praise/celebration-bus";

export interface LessonCountdownOptions {
    enabled: boolean;
    /** Seconds per exercise step (already clamped by the pref). */
    seconds: number;
    /** Current step index - a change resets the ring. */
    stepIndex: number;
    isExerciseStep: boolean;
    /** True once the step's answer was checked - the ring pauses. */
    checked: boolean;
}

export interface LessonCountdown {
    /** Seconds left on the current step. */
    remaining: number;
    /** The full ring length (= the configured seconds). */
    total: number;
    /** True once this step's time ran out (one expiry per step). */
    expired: boolean;
}

export function useLessonCountdown({
    enabled,
    seconds,
    stepIndex,
    isExerciseStep,
    checked,
}: LessonCountdownOptions): LessonCountdown {
    const [remaining, setRemaining] = useState<number>(seconds);
    const [expired, setExpired] = useState<boolean>(false);

    // Render-phase reset on step change (the useTimedLesson pattern):
    // the new step starts with a full ring and a re-armed expiry.
    const stepRef = useRef(stepIndex);
    if (stepRef.current !== stepIndex) {
        stepRef.current = stepIndex;
        setRemaining(seconds);
        setExpired(false);
    }

    const running =
        enabled && isExerciseStep && !checked && !expired && remaining > 0;

    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => {
            setRemaining((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [running]);

    useEffect(() => {
        if (!enabled || !isExerciseStep || checked) return;
        if (remaining === 0 && !expired) {
            setExpired(true);
            emitCelebration({type: "answer_wrong"});
        }
    }, [remaining, expired, enabled, isExerciseStep, checked]);

    return {remaining, total: seconds, expired};
}
