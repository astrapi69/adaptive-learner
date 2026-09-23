/**
 * Set-completion review (#2792) — every mistake of one set, aggregated.
 *
 * Finishing a set used to end in a trophy card and nothing else: the app
 * recorded, per element, the error count, the streak, the mastery flag and the
 * learner's own wrong answer — and never showed any of it as a set-wide
 * picture. The lesson summary counts only the lesson just played; the learning
 * path shows a single integer per set. The data was complete and unused.
 *
 * This module is the missing aggregation: pure, storage-agnostic and scoped to
 * ONE set, so it renders identically in API and Dexie mode and is testable
 * without a storage mock. It deliberately takes raw rows (the shapes
 * ``elementErrors.list`` and ``lessonProgress.list`` already return) instead of
 * fetching, so the view layer owns the loading and this layer owns the maths.
 *
 * "Mastered" and "open" follow the ERRORS, not the SRS flag alone (#3166).
 * ``recordBulk`` writes one row per attempt, correct ones included
 * (``error_count`` 0), and the SRS flag flips only after several correct
 * repeats - so a first run of 12 elements with 3 mistakes used to read
 * "0 % mastered, 12 open" next to "3 mistakes". An element is OPEN while it
 * has a mistake the SRS has not yet marked mastered; every other tracked
 * element (never wrong, or cleared since) counts as mastered, which is what
 * the learner reads under "every mistake at a glance".
 *
 * @example
 * const review = buildSetReview({setId, errors, progress});
 * review.totalErrors;        // 17
 * review.byLesson[0];        // {lessonId: "04.json", errors: 6, elements: 3}
 */

import type {ElementError} from "../../storage/types/learning/element-errors";
import type {LessonProgress} from "../../storage/types";

/** Mistakes attributed to one lesson of the set. */
export interface SetReviewLesson {
  lessonId: string;
  /** Summed ``error_count`` of that lesson's elements. */
  errors: number;
  /** How many distinct elements of that lesson were tracked. */
  elements: number;
}

/** Mistakes attributed to one exercise type. */
export interface SetReviewType {
  type: string;
  errors: number;
  elements: number;
}

/** One element the learner keeps getting wrong. */
export interface SetReviewWeakArea {
  elementKey: string;
  lessonId: string;
  errorCount: number;
  mastered: boolean;
  /** The learner's last wrong answer, for "why did I miss this". */
  lastAnswer: string;
  correctAnswer: string;
}

/** The whole picture for one set. */
export interface SetReview {
  setId: string;
  /** ``false`` when neither errors nor progress exist — render the empty state. */
  hasData: boolean;
  totalErrors: number;
  /** Distinct elements the SRS has seen in this set. */
  elementsTracked: number;
  /** Tracked elements that were never wrong or whose mistake the SRS has
   *  since marked mastered: ``elementsTracked - elementsOpen``. */
  elementsMastered: number;
  /** Tracked elements with at least one mistake and no mastery yet. */
  elementsOpen: number;
  /** ``elementsMastered`` in whole percent (0 when nothing is tracked). */
  masteredShare: number;
  lessonsCompleted: number;
  timeSpentSeconds: number;
  /** Worst lesson first. */
  byLesson: SetReviewLesson[];
  /** Biggest exercise type first. */
  byType: SetReviewType[];
  /** Unmastered before mastered, then by error count. */
  weakAreas: SetReviewWeakArea[];
}

/** Inputs: raw rows plus the set they must be filtered to. */
export interface SetReviewInput {
  setId: string;
  errors: readonly ElementError[];
  progress: readonly LessonProgress[];
  /** Cap for {@link SetReview.weakAreas}. Default 10. */
  weakAreaLimit?: number;
}

function tally<T extends {errors: number; elements: number}>(
  bucket: Map<string, T>,
  key: string,
  seed: () => T,
  errorCount: number,
): void {
  const entry = bucket.get(key) ?? seed();
  entry.errors += errorCount;
  entry.elements += 1;
  bucket.set(key, entry);
}

/**
 * Aggregate one set's element errors and lesson progress into the review.
 *
 * Rows belonging to other sets are ignored, so a caller may pass an unfiltered
 * list. Never throws: missing optional fields degrade to zero/empty.
 */
export function buildSetReview(input: SetReviewInput): SetReview {
  const {setId, weakAreaLimit = 10} = input;
  const errors = input.errors.filter((row) => row.set_id === setId);
  const progress = input.progress.filter((row) => row.set_id === setId);

  const lessons = new Map<string, SetReviewLesson>();
  const types = new Map<string, SetReviewType>();
  let totalErrors = 0;
  let elementsOpen = 0;

  for (const row of errors) {
    const count = row.error_count ?? 0;
    totalErrors += count;
    if (count > 0 && !row.mastered) elementsOpen += 1;
    tally(
      lessons,
      row.lesson_id,
      () => ({lessonId: row.lesson_id, errors: 0, elements: 0}),
      count,
    );
    const type = row.element_type || "unknown";
    tally(types, type, () => ({type, errors: 0, elements: 0}), count);
  }

  const byErrorsDesc = <T extends {errors: number}>(a: T, b: T) =>
    b.errors - a.errors;

  const elementsTracked = errors.length;
  const elementsMastered = elementsTracked - elementsOpen;
  return {
    setId,
    hasData: elementsTracked > 0 || progress.length > 0,
    totalErrors,
    elementsTracked,
    elementsMastered,
    elementsOpen,
    masteredShare:
      elementsTracked === 0
        ? 0
        : Math.round((elementsMastered / elementsTracked) * 100),
    lessonsCompleted: progress.filter((row) => row.status === "completed")
      .length,
    timeSpentSeconds: progress.reduce(
      (sum, row) => sum + (row.time_spent_seconds ?? 0),
      0,
    ),
    byLesson: [...lessons.values()].sort(byErrorsDesc),
    byType: [...types.values()].sort(byErrorsDesc),
    weakAreas: errors
      .filter((row) => (row.error_count ?? 0) > 0)
      .slice()
      .sort((a, b) => {
        if (a.mastered !== b.mastered) return a.mastered ? 1 : -1;
        return (b.error_count ?? 0) - (a.error_count ?? 0);
      })
      .slice(0, weakAreaLimit)
      .map((row) => ({
        elementKey: row.element_key,
        lessonId: row.lesson_id,
        errorCount: row.error_count ?? 0,
        mastered: Boolean(row.mastered),
        lastAnswer: row.user_answer ?? "",
        correctAnswer: row.correct_answer ?? "",
      })),
  };
}
