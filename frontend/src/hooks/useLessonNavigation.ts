import {useCallback, useEffect, useMemo, useState} from "react";

import {findPrecedingTheoryIndex} from "../lib/lesson/theory-link";
import type {ContentLesson} from "../storage/types";

/**
 * Inputs for {@link useLessonNavigation}: the loaded lesson, the
 * current position, and the step setter from ``useLesson``.
 */
export interface UseLessonNavigationOptions {
    lesson: ContentLesson | null;
    currentStepIndex: number;
    goToStep: (index: number) => void;
}

/**
 * Result of {@link useLessonNavigation}: the #140 theory back-link
 * surface the page renders around the exercise dispatcher.
 */
export interface UseLessonNavigationResult {
    /** Nearest preceding theory step, or ``null`` when none exists
     *  (drives the "Re-read theory" link visibility). */
    precedingTheoryIndex: number | null;
    /** Origin exercise of a followed theory link, or ``null`` when
     *  no return affordance should render. */
    theoryReturnIndex: number | null;
    /** Navigate to the preceding theory step, remembering the
     *  origin exercise for the way back. */
    openTheoryFromExercise: () => void;
    /** Return to the exercise the learner came from. */
    returnToExercise: () => void;
}

/**
 * Step-change navigation concerns of the lesson viewer (#354,
 * extracted from ``LessonPage``): scroll the viewport back to the
 * top on every step change, plus the #140 theory back-link
 * round-trip (exercise -> nearest preceding theory -> back to the
 * exact origin exercise).
 */
export function useLessonNavigation({
    lesson,
    currentStepIndex,
    goToStep,
}: UseLessonNavigationOptions): UseLessonNavigationResult {
    // B2 (Tailwind migration) — scroll the viewport to the top on
    // every step change so a long step doesn't leave the learner
    // mid-page. Guarded for the headless test env (scrollTo may be
    // a stub).
    useEffect(() => {
        try {
            document.getElementById("root")?.scrollTo({top: 0});
            window.scrollTo({top: 0});
        } catch {
            /* no-op in environments without a real scroll. */
        }
    }, [currentStepIndex]);

    // #140 — let an exercise step link back to the theory it
    // practices. The target is the nearest preceding theory step in
    // the same lesson (runtime-derived, no schema field). When the
    // learner follows the link we remember the origin exercise so a
    // "back to exercise" affordance on the theory step returns them
    // exactly where they were.
    const [theoryReturnIndex, setTheoryReturnIndex] = useState<number | null>(
        null,
    );
    const precedingTheoryIndex = useMemo(
        () =>
            lesson
                ? findPrecedingTheoryIndex(lesson.steps, currentStepIndex)
                : null,
        [lesson, currentStepIndex],
    );
    const openTheoryFromExercise = useCallback(() => {
        if (precedingTheoryIndex === null) return;
        setTheoryReturnIndex(currentStepIndex);
        goToStep(precedingTheoryIndex);
    }, [precedingTheoryIndex, currentStepIndex, goToStep]);
    const returnToExercise = useCallback(() => {
        if (theoryReturnIndex === null) return;
        const target = theoryReturnIndex;
        setTheoryReturnIndex(null);
        goToStep(target);
    }, [theoryReturnIndex, goToStep]);
    // Drop the pending return target once the learner is on a
    // non-theory step again (they returned, or moved on via the
    // lesson's own prev/next) so the back affordance never lingers.
    useEffect(() => {
        if (!lesson) return;
        const cur = lesson.steps[currentStepIndex];
        if (cur && cur.type !== "theory" && theoryReturnIndex !== null) {
            setTheoryReturnIndex(null);
        }
    }, [lesson, currentStepIndex, theoryReturnIndex]);

    return {
        precedingTheoryIndex,
        theoryReturnIndex,
        openTheoryFromExercise,
        returnToExercise,
    };
}
