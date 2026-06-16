/**
 * hints/hint-usage — a tiny, session-scoped record of which exercises the
 * learner revealed a hint on (#594 Hint Economy).
 *
 * The hint affordance (``ExerciseHint``) is rendered deep inside each
 * exercise renderer, but the hint signal has to reach two distant places:
 * the per-element attempts persisted at lesson completion (so the SRS layer
 * shortens the review interval) and the lesson-step result (so the summary
 * can count "hints used"). Rather than thread a callback through every
 * renderer, the reveal marks the exercise id here, and the recordBulk /
 * step-result sites read it back via {@link wasHintUsed} and
 * {@link stampHintUsage}.
 *
 * In-memory + module-scoped (one lesson session). Cleared by the lesson
 * viewer on mount via {@link clearHintUsage} so a hint on a reused exercise
 * id from a prior lesson never bleeds across. Storage-agnostic and
 * app-session-only — nothing is persisted here.
 */

import type { ElementAttempt } from "../../storage/types";

const usedExerciseIds = new Set<string>();

/** Mark that the learner revealed a hint on ``exerciseId``. */
export function markHintUsed(exerciseId: string): void {
  if (exerciseId) usedExerciseIds.add(exerciseId);
}

/** Whether a hint was revealed on ``exerciseId`` this session. */
export function wasHintUsed(exerciseId: string): boolean {
  return usedExerciseIds.has(exerciseId);
}

/** Forget all recorded hint usage (call when a lesson session starts). */
export function clearHintUsage(): void {
  usedExerciseIds.clear();
}

/**
 * Return a copy of ``attempts`` with ``hint_used`` stamped on every attempt
 * whose ``exercise_id`` was hinted this session. Pure — never mutates the
 * input. Attempts already carrying ``hint_used: true`` keep it.
 */
export function stampHintUsage(
  attempts: readonly ElementAttempt[],
): ElementAttempt[] {
  return attempts.map((attempt) =>
    attempt.hint_used || wasHintUsed(attempt.exercise_id)
      ? { ...attempt, hint_used: true }
      : attempt,
  );
}
