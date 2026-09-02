/**
 * useLessonTension (#2878) - the game-mode tension cluster for the
 * lesson page: live prefs, the mode/summary gates, the hearts state
 * and the per-exercise countdown, bundled so the page renders from a
 * handful of flags instead of carrying the branch logic itself.
 *
 * Gates (all here, none in the page):
 * - both systems require playful mode AND their own opt-in;
 * - both stay off in exam (no per-answer feedback to leak) and timed
 *   lessons (that mode has its own timer + auto-advance);
 * - hearts pause on the summary, so the correction-round drills never
 *   cost one; the ring only runs on a live exercise step.
 *
 * Null-safe against a still-loading lesson - the page mounts its
 * hooks before the loading early-return.
 */

import {useEffect} from "react";

import type {ContentLessonStep} from "../../storage/types";
import type {LessonMode} from "../../lib/learning/lessonModePref";
import {isPlayableExerciseStep} from "../../lib/lesson/lesson-step-state";
import {usePlayfulTension} from "../settings/usePlayfulTension";
import {useLessonCountdown, type LessonCountdown} from "./useLessonCountdown";
import {useLessonHearts} from "./useLessonHearts";

interface LessonLike {
    steps: ContentLessonStep[];
}

export interface LessonTensionOptions {
    playful: boolean;
    /** Loaded lesson (null while loading). */
    lesson: object | null;
    /** The lesson actually played (reverse mode may transform it). */
    playedLesson: LessonLike | null;
    currentStepIndex: number;
    lessonMode: LessonMode;
    /** Two-phase check state of the current step. */
    checked: boolean;
    /** Lesson identity - a change refills the hearts. */
    source: string;
    setId: string;
    filename: string;
}

export interface LessonTension {
    /** Render the hearts row (live run only). */
    showHearts: boolean;
    hearts: number;
    maxHearts: number;
    /** The run is out of hearts - show the retry dialog. */
    depleted: boolean;
    resetHearts: () => void;
    /** Render the countdown ring (live exercise step only). */
    showRing: boolean;
    countdown: LessonCountdown;
    /** #2889 - the hearts system ran AND no heart was lost, the
     *  full-hearts ticket condition read on the summary. */
    fullHeartsRun: boolean;
}

export function useLessonTension({
    playful,
    lesson,
    playedLesson,
    currentStepIndex,
    lessonMode,
    checked,
    source,
    setId,
    filename,
}: LessonTensionOptions): LessonTension {
    const tension = usePlayfulTension();
    const totalSteps = playedLesson?.steps.length ?? 0;
    const onSummary = lesson !== null && currentStepIndex >= totalSteps;
    const onExercise = isPlayableExerciseStep(
        onSummary ? null : (playedLesson?.steps[currentStepIndex] ?? null),
    );
    const modeOk = lessonMode !== "exam" && lessonMode !== "timed";

    const heartsActive = playful && tension.heartsOn && modeOk;
    const {hearts, maxHearts, depleted, resetHearts} = useLessonHearts(
        heartsActive && !onSummary,
        tension.heartsCount,
    );

    const countdownActive =
        playful && tension.countdownOn && modeOk && !onSummary;
    const countdown = useLessonCountdown({
        enabled: countdownActive,
        seconds: tension.countdownSeconds,
        stepIndex: currentStepIndex,
        isExerciseStep: onExercise,
        checked,
    });

    useEffect(() => {
        resetHearts();
    }, [source, setId, filename, resetHearts]);

    return {
        showHearts: heartsActive && !onSummary,
        hearts,
        maxHearts,
        depleted,
        resetHearts,
        showRing: countdownActive && onExercise,
        countdown,
        fullHeartsRun: heartsActive && maxHearts > 0 && hearts === maxHearts,
    };
}
