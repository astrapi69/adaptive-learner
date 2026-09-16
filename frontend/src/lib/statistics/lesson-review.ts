/**
 * Lesson-completion review (#3124) — the set review, scoped to one lesson.
 *
 * The end-of-lesson summary had a "Detailed evaluation" toggle (#3031) that
 * only expanded what the compact card already held; the set-completion page
 * (#2792) had the real evaluation - key figures, mistakes per exercise type,
 * the weak spots with the learner's own wrong answer - and nothing at the
 * lesson end reused it, although every input exists per element. This is
 * that reuse: the SAME aggregator ({@link buildSetReview}) over the rows of
 * ONE lesson, so both views compute one number the same way and the lesson
 * report is the set report with a narrower filter, not a second maths.
 *
 * Pure and storage-agnostic like its parent: raw rows in, the review out.
 *
 * @example
 * const review = buildLessonReview({
 *   setId, lessonId: "04.json", errors, progress: progressRow ? [progressRow] : [],
 * });
 * review.totalErrors;   // mistakes on this lesson's elements
 * review.byLesson;      // at most one entry, the lesson itself
 */

import type {ElementError} from "../../storage/types/learning/element-errors";
import type {LessonProgress} from "../../storage/types";
import {buildSetReview, type SetReview} from "./set-review";

/** Inputs: raw rows plus the set AND lesson they must be filtered to. */
export interface LessonReviewInput {
  setId: string;
  /** The lesson file name, as stored in ``ElementError.lesson_id`` and
   *  ``LessonProgress.lesson_filename``. */
  lessonId: string;
  errors: readonly ElementError[];
  progress: readonly LessonProgress[];
  /** Cap for the weak areas. Default 10. */
  weakAreaLimit?: number;
}

/**
 * Aggregate one lesson's element errors and progress into a review.
 *
 * Rows of other lessons (and other sets) are ignored, so a caller may pass
 * unfiltered lists. Never throws.
 */
export function buildLessonReview(input: LessonReviewInput): SetReview {
  const {setId, lessonId, weakAreaLimit} = input;
  return buildSetReview({
    setId,
    weakAreaLimit,
    errors: input.errors.filter((row) => row.lesson_id === lessonId),
    progress: input.progress.filter(
      (row) => row.lesson_filename === lessonId,
    ),
  });
}
