/**
 * Mid-lesson motivation (pure).
 *
 * Decides whether entering a given step should surface a subtle
 * encouragement toast: the halfway point of a longer lesson, or the
 * final step. Returns ``null`` when no message applies (most steps).
 * Kept pure + free of i18n/toast so the policy is unit-testable; the
 * caller maps the kind to a localized string and a subtle toast.
 */

export type MotivationKind = "halftime" | "last" | null;

/** Lessons shorter than this never fire the halftime message. */
const MIN_STEPS_FOR_HALFTIME = 4;

/**
 * @param stepIndex zero-based index of the step being entered
 * @param totalSteps total number of steps in the lesson
 */
export function lessonMotivation(
    stepIndex: number,
    totalSteps: number,
): MotivationKind {
    if (totalSteps <= 1 || stepIndex < 0 || stepIndex >= totalSteps) {
        return null;
    }
    if (stepIndex === totalSteps - 1) {
        return "last";
    }
    if (
        totalSteps >= MIN_STEPS_FOR_HALFTIME &&
        stepIndex === Math.floor(totalSteps / 2)
    ) {
        return "halftime";
    }
    return null;
}
