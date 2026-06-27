/**
 * Pure per-step state helpers for the lesson viewer (extracted from
 * LessonPage for the complexity burn-down #417).
 */

import { SUPPORTED_EXERCISE_TYPES } from "../../components/exercises";
import type {
  ContentLesson,
  ContentLessonStep,
  LessonProgress,
  LessonStepResultStored,
} from "../../storage/types";

/**
 * The persisted result for the step at ``currentStepIndex``, or
 * ``undefined`` when the lesson/step isn't loaded or has no result yet.
 */
export function storedStepResult(
  lesson: ContentLesson | null,
  currentStepIndex: number,
  progress: LessonProgress | null,
): LessonStepResultStored | undefined {
  const steps = lesson?.steps;
  if (!steps || currentStepIndex >= steps.length) return undefined;
  return progress?.step_results?.[steps[currentStepIndex].id];
}

/**
 * True when ``step`` is a playable exercise step — i.e. it gates the
 * two-phase Check/Next button. Theory steps and unsupported/placeholder
 * exercise types keep the plain always-enabled "Next" button.
 */
export function isPlayableExerciseStep(
  step: ContentLessonStep | null,
): boolean {
  return (
    step !== null &&
    step.type !== "theory" &&
    step.exercise != null &&
    SUPPORTED_EXERCISE_TYPES.has(step.exercise.type)
  );
}
