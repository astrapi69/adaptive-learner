/**
 * exercise-identity — the ONE rule for which id string names an exercise in
 * learner data (#2130, EXP-045 Option A).
 *
 * SRS / progress rows join content by ``exercise_id``. Since engine schema
 * 1.9 an exercise (and card) carries an author-owned, version-stable
 * ``stable_id`` next to its authored slug ``id``; the slug is only unique
 * within a lesson and positional generators re-mint it, so it drifts across
 * versions. New learner rows are therefore keyed by ``stable_id`` when the
 * content ships one, with the authored ``id`` as the fallback for content
 * that predates schema 1.9.
 *
 * Readers stay tolerant in BOTH directions: a row written before the key
 * switch carries the authored id, a row written after it carries the
 * stable_id, and both must resolve against the same exercise. Use
 * {@link matchesExerciseIdentity} wherever a row id is compared against an
 * exercise, never a bare ``ex.id === row.exercise_id``.
 *
 * @example
 * ```ts
 * const attempt = {exercise_id: exerciseIdentityOf(exercise) ?? "", ...};
 * const rows = allRows.filter((r) => matchesExerciseIdentity(exercise, r.exercise_id));
 * ```
 */

/** The two id fields any exercise-shaped object may carry. ``stable_id``
 *  admits ``null`` because the engine's generated type does. */
export interface IdentityBearingExercise {
    id?: string;
    stable_id?: string | null;
}

/** The identity new learner rows are keyed by: ``stable_id`` when the
 *  content ships one, else the authored ``id``. */
export function exerciseIdentityOf(
    exercise: IdentityBearingExercise,
): string | undefined {
    return exercise.stable_id ?? exercise.id;
}

/** Whether a learner row's ``exercise_id`` names this exercise — under
 *  EITHER of its ids, so pre-switch rows keep resolving. */
export function matchesExerciseIdentity(
    exercise: IdentityBearingExercise,
    rowExerciseId: string,
): boolean {
    return (
        rowExerciseId === exercise.stable_id || rowExerciseId === exercise.id
    );
}
