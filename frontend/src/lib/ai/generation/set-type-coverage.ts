/**
 * #2356 — set-wide exercise-type coverage.
 *
 * ``distributionGaps`` ({@link ./exercise-distribution}) answers "which types
 * are missing from ONE generation run". For a whole book set (one lesson per
 * chapter) the meaningful question is different: does the SET, across all its
 * lessons, carry enough type variety? A per-lesson view cannot answer that — a
 * 23-lesson set can be four types lesson-by-lesson and still four types overall.
 *
 * This module measures diversity across a set: the distinct exercise types over
 * every lesson's exercises, and whether that clears a target (default: more than
 * four distinct types, the count a real generated non-fiction set was stuck at).
 *
 * Library-grade: pure, no app-state / network imports.
 */

/** The minimum distinct-type count a healthy set should exceed (#2356: a real
 *  23-lesson set was stuck at exactly four). */
export const SET_TYPE_TARGET = 4;

/** Distinct exercise types across a flat list of exercises, in first-seen
 *  order. Works on anything carrying a ``type`` string (generated cards or
 *  mapped ``ContentLessonExercise``). */
export function distinctExerciseTypes(exercises: ReadonlyArray<{ type: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const exercise of exercises) {
    if (!seen.has(exercise.type)) {
      seen.add(exercise.type);
      out.push(exercise.type);
    }
  }
  return out;
}

/** Set-wide type-coverage report. */
export interface SetTypeCoverage {
  /** Distinct exercise types across the whole set (first-seen order). */
  types: string[];
  /** ``types.length`` — how many distinct types the set carries. */
  count: number;
  /** True when the set clears {@link SET_TYPE_TARGET} distinct types. */
  meetsTarget: boolean;
}

/**
 * Measure type coverage across a set: flatten every lesson's exercises and
 * report the distinct types and whether the set clears ``target``.
 *
 * @param lessonExercises - One entry per lesson: that lesson's exercises.
 * @param target - Minimum distinct types the set should EXCEED (default
 *                 {@link SET_TYPE_TARGET}).
 */
export function setTypeCoverage(
  lessonExercises: ReadonlyArray<ReadonlyArray<{ type: string }>>,
  target: number = SET_TYPE_TARGET,
): SetTypeCoverage {
  const types = distinctExerciseTypes(lessonExercises.flat());
  return { types, count: types.length, meetsTarget: types.length > target };
}
