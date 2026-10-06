/**
 * The correction summary of a lesson run (#3575): which of the run's
 * mistakes are corrected by now, with what the learner answered first,
 * the correct answer and, for those still open, the exercise's own
 * explanation.
 *
 * Two steps, so the first-pass part can travel where the lesson and its
 * progress are not at hand (the Retry-errors router state):
 *
 * 1. {@link collectRunMistakes} reads the frozen first pass from the
 *    lesson and its ``step_results`` (the same breakdown the answers
 *    overview shows).
 * 2. {@link buildCorrectionSummary} decides "corrected" from the live SRS
 *    rows, with ``openFailedExercises`` - exactly the predicate the
 *    correction block and the compact summary's count use, so every view
 *    shows the same verdict for the same run.
 *
 * Granularity is the exercise, as in "{corrected} of {total} corrected".
 *
 * @example
 * ```ts
 * const run = collectRunMistakes(lesson, progress);
 * const summary = buildCorrectionSummary(run, sessionErrors);
 * summary.entries.filter((entry) => !entry.corrected);
 * ```
 */

import type {
  ContentLesson,
  ElementError,
  LessonProgress,
} from "../../storage/types";
import type { FirstTryTally, RunMistake, RunMistakes } from "./correction-summary.types";
import { collectFailedExercises, openFailedExercises } from "./error-replay";

export type { RunMistakes } from "./correction-summary.types";
import { buildExerciseBreakdown } from "./lesson-summary";

/** A mistake with its live verdict. */
export interface CorrectionSummaryEntry extends RunMistake {
  corrected: boolean;
  /** The exercise's explanation while the mistake is open, else null. */
  explanation: string | null;
}

export interface CorrectionSummary {
  entries: CorrectionSummaryEntry[];
  correctedCount: number;
  total: number;
  firstTry: FirstTryTally;
}

/** The run's mistakes and first-try tally from the lesson and its progress. */
export function collectRunMistakes(
  lesson: ContentLesson,
  progress: LessonProgress | null,
): RunMistakes {
  const failed = new Set(collectFailedExercises(lesson, progress));
  const breakdown = buildExerciseBreakdown(lesson, progress);
  const byStep = new Map(breakdown.map((entry) => [entry.stepId, entry]));
  const mistakes: RunMistake[] = [];
  for (const step of lesson.steps) {
    if (!step.exercise || !failed.has(step.exercise)) continue;
    const entry = byStep.get(step.id);
    if (!entry) continue;
    mistakes.push({
      exercise: step.exercise,
      stepId: step.id,
      title: entry.title,
      question: entry.question,
      firstAnswer: entry.userAnswer,
      correctAnswer: entry.canonicalAnswer,
    });
  }
  const answered = breakdown.filter((entry) => entry.attempted && entry.total > 0);
  return {
    mistakes,
    firstTry: {
      correct: answered.filter((entry) => entry.fullyCorrect).length,
      total: answered.length,
    },
  };
}

/** The live verdict per mistake, from the SRS rows of this lesson. */
export function buildCorrectionSummary(
  run: RunMistakes,
  sessionErrors: readonly ElementError[],
): CorrectionSummary {
  const open = new Set(
    openFailedExercises(
      run.mistakes.map((mistake) => mistake.exercise),
      sessionErrors,
    ),
  );
  const entries = run.mistakes.map((mistake) => {
    const corrected = !open.has(mistake.exercise);
    return {
      ...mistake,
      corrected,
      explanation: corrected ? null : (mistake.exercise.explanation ?? null),
    };
  });
  return {
    entries,
    correctedCount: entries.filter((entry) => entry.corrected).length,
    total: entries.length,
    firstTry: run.firstTry,
  };
}
