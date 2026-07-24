/**
 * useLessonMotivation (#1790 — extracted from Lesson.tsx).
 *
 * Mid-lesson motivation (#586): a subtle toast at the halfway step
 * and on the last step. The ref guards against StrictMode
 * double-effect + re-renders so each step fires at most once.
 */

import {useEffect, useRef} from "react";

import {useI18n} from "../../ui/useI18n";
import {lessonMotivation} from "../../../lib/lesson/motivation";
import {notify} from "../../../utils/notify";
import type {ContentLesson} from "../../../storage/types";

/**
 * Fire the halftime / last-step motivation toast for the current step.
 *
 * @example
 * useLessonMotivation({lesson, currentStepIndex});
 */
export function useLessonMotivation({
    lesson,
    currentStepIndex,
}: {
    lesson: ContentLesson | null;
    currentStepIndex: number;
}) {
    const {t} = useI18n();
    const motivationStepRef = useRef<number>(-1);
    useEffect(() => {
        if (!lesson) return;
        const total = lesson.steps.length;
        if (currentStepIndex >= total) return; // summary screen
        if (motivationStepRef.current === currentStepIndex) return;
        motivationStepRef.current = currentStepIndex;
        const kind = lessonMotivation(currentStepIndex, total);
        // Pass-through + short so the bottom-right motivation toast never
        // blocks the sticky lesson footer's Check/Next buttons (#589 fix).
        const motivationToast = {autoClose: 3000, passThrough: true} as const;
        if (kind === "halftime") {
            notify.info(
                t("lesson.motivation.halftime", "Halfway there - keep going!"),
                motivationToast,
            );
        } else if (kind === "last") {
            notify.info(
                t("lesson.motivation.last", "Last one - finish strong!"),
                motivationToast,
            );
        }
    }, [lesson, currentStepIndex, t]);
}
