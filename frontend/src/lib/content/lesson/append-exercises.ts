/**
 * AIX-02 (EXP-036) — append generated exercises to a lesson.
 *
 * The AI exercise generator (AIX-01 + the AIX-02 quality gate) produces a
 * list of {@link ContentLessonExercise}. This helper wraps each one as an
 * ``exercise`` step and appends it to a base {@link ContentLesson} (the
 * deterministic study guide built from the chat analysis), returning a new
 * lesson — the input is never mutated. The merged lesson is re-validated
 * so a bad AI exercise can never slip into a saved set.
 *
 * Library-grade: pure, no app-state imports.
 */

import type { ContentLesson, ContentLessonExercise, ContentLessonStep } from "../../../storage/types";
import { validateGeneratedLesson } from "../analysis/analysis-to-lesson";

/** Wrap an exercise as a slug-safe ``exercise`` step. */
function exerciseStep(exercise: ContentLessonExercise): ContentLessonStep {
  return {
    id: `step-${exercise.id}`,
    type: "exercise",
    title: null,
    body: null,
    exercise,
  };
}

/**
 * Return a copy of ``lesson`` with ``exercises`` appended as exercise
 * steps. When ``exercises`` is empty the original lesson is returned
 * unchanged. Throws (via {@link validateGeneratedLesson}) if the merged
 * lesson would be schema-invalid.
 *
 * @param lesson - The base lesson (theory steps, possibly some exercises).
 * @param exercises - Generated exercises to append.
 * @returns A new, validated lesson.
 */
export function appendExercisesToLesson(
  lesson: ContentLesson,
  exercises: ContentLessonExercise[],
): ContentLesson {
  if (exercises.length === 0) return lesson;
  const merged: ContentLesson = {
    ...lesson,
    steps: [...lesson.steps, ...exercises.map(exerciseStep)],
  };
  validateGeneratedLesson(merged);
  return merged;
}
