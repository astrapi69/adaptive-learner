/**
 * useLessonStepState (#1790 — extracted from Lesson.tsx).
 *
 * The two-phase "Prüfen" -> "Weiter" step-state cluster of the lesson
 * runner: the exercise handle, the answerable/checked flags, the
 * entered-reviewed reconstruction, the render-phase per-step reset,
 * and the Enter-shortcut wiring. The page assigns
 * ``enterStateRef.current`` each render (after its loading guards)
 * so the listener reads fresh navigation state without
 * re-subscribing.
 */

import {useRef, useState} from "react";

import type {ExerciseHandle} from "../../../components/exercises";
import {storedStepResult} from "../../../lib/lesson/lesson-step-state";
import {
    useLessonEnterKey,
    type LessonEnterNav,
} from "../interaction/useLessonEnterKey";
import {useLessonShortcuts} from "../interaction/useLessonShortcuts";
import type {ContentLesson, LessonProgress, RawAnswer} from "../../../storage/types";

export interface UseLessonStepStateOptions {
    lesson: ContentLesson | null;
    currentStepIndex: number;
    progress: LessonProgress | null;
}

/**
 * Own the per-step check state of the lesson runner.
 *
 * @example
 * const stepState = useLessonStepState({lesson, currentStepIndex, progress});
 * <LessonStepView exerciseRef={stepState.exerciseRef}
 *     onInteraction={stepState.setAnswerable} ... />
 */
export function useLessonStepState({
    lesson,
    currentStepIndex,
    progress,
}: UseLessonStepStateOptions) {
    // BUG P1 / Problem 1 — two-phase "Prüfen" → "Weiter" button.
    // The active exercise reports whether its answer is checkable
    // (``answerable``) so the shared button can enable; the parent
    // drives evaluation through ``exerciseRef`` on the "Prüfen"
    // click; ``checked`` flips once the answer is graded so the
    // next click advances. All three reset whenever the step
    // changes (so a fresh exercise starts at "Prüfen" disabled).
    const exerciseRef = useRef<ExerciseHandle>(null);
    const [answerable, setAnswerable] = useState(false);
    const [checked, setChecked] = useState(false);
    // Enter-key shortcut (#103). The listener is registered once and
    // reads the latest step state through a ref (the state is computed
    // after the page's loading guards). ``enterLockRef`` blocks a
    // double Check between ``submit()`` and the ``checked`` flip.
    const lessonShortcutsEnabled = useLessonShortcuts();
    const enterStateRef = useRef<LessonEnterNav | null>(null);
    const enterLockRef = useRef(false);
    // BUG P1 / Problem 2 — when a step is ENTERED with a result
    // already stored, it renders locked (reviewed) so the learner
    // cannot re-answer it. ``reviewedRaw`` carries the persisted
    // answer for an exact reconstruction; ``enteredReviewed`` with
    // a null ``reviewedRaw`` is a pre-feature legacy row that gets
    // the compact fallback panel instead.
    const [enteredReviewed, setEnteredReviewed] = useState(false);
    const [reviewedRaw, setReviewedRaw] = useState<RawAnswer | null>(null);
    // Reset the per-step state the instant the step changes.
    // A render-phase reset (the React "adjust state on prop
    // change" pattern) runs BEFORE the freshly-mounted child's
    // ``onInteraction`` effect, so an exercise that is answerable
    // on mount is not clobbered back to disabled — unlike an
    // effect, whose parent-after-child ordering would lose that
    // first signal. ``progress`` updating mid-step (after a check)
    // does NOT re-run this, so the just-graded step keeps its live
    // feedback instead of flipping into the locked view.
    // -1 sentinel so the FIRST render also computes the reviewed
    // state (a step entered directly on a completed step, e.g. a
    // resume / deep-link, renders locked — not just steps reached
    // by in-session navigation).
    const prevStepIndexRef = useRef(-1);
    if (prevStepIndexRef.current !== currentStepIndex) {
        prevStepIndexRef.current = currentStepIndex;
        const stored = storedStepResult(lesson, currentStepIndex, progress);
        setAnswerable(false);
        setChecked(false);
        setEnteredReviewed(stored != null);
        setReviewedRaw(stored?.raw_answer ?? null);
        enterLockRef.current = false;
    }

    // Keyboard shortcut (#103): Enter drives the two-phase Check / Next
    // button. The listener (shared with the Error-Replay runner via
    // ``useLessonEnterKey``) reads the latest step state through
    // ``enterStateRef`` (updated each render by the page).
    useLessonEnterKey({
        enabled: lessonShortcutsEnabled,
        exerciseRef,
        enterStateRef,
        enterLockRef,
    });

    return {
        exerciseRef,
        answerable,
        setAnswerable,
        checked,
        setChecked,
        enteredReviewed,
        reviewedRaw,
        enterStateRef,
    };
}
