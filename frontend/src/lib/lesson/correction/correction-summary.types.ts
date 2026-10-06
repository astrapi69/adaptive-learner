/**
 * The first-pass record of a lesson run (#3575), split from
 * ``correction-summary.ts`` so the Retry-errors payload type
 * (``error-replay.ts``) can name it without an import cycle.
 */

import type { ContentLessonExercise } from "../../../storage/types";

/** One exercise the run got wrong, as it stood after the first pass. */
export interface RunMistake {
  exercise: ContentLessonExercise;
  stepId: string;
  title: string;
  /** What the step asked; null when the exercise carries no question. */
  question: string | null;
  /** The learner's first answer; null for types without a text answer. */
  firstAnswer: string | null;
  correctAnswer: string;
}

/** Exercises answered right at the first try, of those answered. */
export interface FirstTryTally {
  correct: number;
  total: number;
}

/** The first-pass record of a run: its mistakes and the first-try tally. */
export interface RunMistakes {
  mistakes: RunMistake[];
  firstTry: FirstTryTally;
}
