/**
 * Supported mission check functions (EXP-010 / Phase 56C).
 *
 * A mission is only assignable if its ``check_function`` can be
 * evaluated against EXISTING data (LessonProgress / ElementError /
 * LearningSession / streak) - the EXP-010 rule forbids new
 * tracking beyond UserMission, and an un-trackable mission would
 * never complete (violating "always achievable").
 *
 * The five catalog entries whose checks need data we do NOT yet
 * record per-day are intentionally NOT in this set, so the
 * generator never assigns them:
 *   - review_sessions_completed_today  (no review-session log)
 *   - overdue_cleared_today            (needs queue snapshot at start of day)
 *   - adaptive_lessons_started_today   (no adaptive-start marker)
 *   - cloze_exercises_today            (no per-exercise-type day log)
 *   - exercise_types_used_today        (no per-exercise-type day log)
 * They remain in the catalog so a future phase can wire the
 * tracking and flip them on without a content migration.
 */

export const SUPPORTED_CHECK_FUNCTIONS: ReadonlySet<string> = new Set([
    "lessons_completed_today",
    "lessons_min_2_stars_today",
    "lessons_min_3_stars_today",
    "new_sets_started_today",
    "elements_reviewed_today",
    "elements_mastered_today",
    "perfect_lessons_today",
    "minutes_learned_today",
    "streak_kept_today",
    "current_streak_days",
    "weekend_learning_today",
]);

/** Whether a mission's ``check_function`` can be evaluated against
 *  existing data, and so is safe for the generator to assign. */
export function isSupportedCheck(checkFunction: string): boolean {
    return SUPPORTED_CHECK_FUNCTIONS.has(checkFunction);
}
