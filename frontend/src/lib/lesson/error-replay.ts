/**
 * error-replay — extract the exercises a learner got WRONG in a
 * lesson run, for the "Fehler wiederholen" / "Retry Errors" flow.
 *
 * Distinct from the other error surfaces:
 *   - Correction Block generates NEW cloze exercises from errors.
 *   - Adaptive Lesson generates from ALL errors across all lessons.
 *   - Review (SRS) replays a queue spanning all lessons on a schedule.
 *   - Error Replay: the EXACT same exercises the learner just failed,
 *     immediately, one more time.
 *
 * "Failed" = an exercise step whose stored result scored fewer correct
 * elements than its total (``correct < total``). Theory steps and
 * exercises the learner aced are skipped. Pure + storage-agnostic so
 * it tests trivially and runs the same in API + Dexie modes.
 */

import type {
    ContentLesson,
    ContentLessonExercise,
    LessonProgress,
} from "../../storage/types";

/** The failed exercises of a lesson run, in lesson order. Empty when
 *  there's no progress, the lesson was perfect, or only theory steps
 *  were touched. */
export function collectFailedExercises(
    lesson: ContentLesson,
    progress: LessonProgress | null,
): ContentLessonExercise[] {
    if (!progress) return [];
    const failed: ContentLessonExercise[] = [];
    for (const step of lesson.steps) {
        if (step.type !== "exercise" || !step.exercise) continue;
        const result = progress.step_results[step.id];
        // Only steps that were attempted AND scored below full.
        if (result && result.total > 0 && result.correct < result.total) {
            failed.push(step.exercise);
        }
    }
    return failed;
}

/** Count of failed exercises — drives the Next-Step error-replay
 *  card's availability + "{count} exercises again" label. */
export function failedExerciseCount(
    lesson: ContentLesson,
    progress: LessonProgress | null,
): number {
    return collectFailedExercises(lesson, progress).length;
}
