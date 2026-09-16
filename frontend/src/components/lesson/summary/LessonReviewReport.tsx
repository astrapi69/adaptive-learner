/**
 * The set-style review inside the detailed end-of-lesson evaluation (#3124).
 *
 * "Detailed evaluation" (#3031) used to expand only what the compact card
 * already held. The set-completion page (#2792) has the actual evaluation -
 * key figures, mistakes per exercise type, the weak spots with the learner's
 * own wrong answer, the jump into targeted practice - and nothing at the
 * lesson end reused it. This renders exactly that report for the finished
 * lesson: the SAME aggregator, scoped to the lesson ({@link buildLessonReview}),
 * and the SAME renderer ({@link ReviewReport}), so lesson end and set end
 * compute and show one truth.
 *
 * Self-gated: renders nothing in the compact view. Lives in its own component
 * so ``LessonSummary`` stays a flat composition of self-gating sections.
 *
 * @example
 * <LessonReviewReport detailed={detailed} lesson={lesson} setId={setId}
 *   lessonFilename={filename} sessionErrors={errors} progress={progress}
 *   userId={userId} t={t} />
 */

import { useMemo } from "react";

import ReviewReport from "../../progress/ReviewReport";
import { buildLessonReview } from "../../../lib/statistics/lesson-review";
import type {
  ContentLesson,
  ElementError,
  LessonProgress,
} from "../../../storage/types";

type TFn = (key: string, fallback?: string) => string;

interface LessonReviewReportProps {
  /** True while the summary shows its detailed view. */
  detailed: boolean;
  lesson: ContentLesson;
  setId: string;
  lessonFilename: string;
  /** This lesson's SRS rows (``useLessonSessionErrors``). */
  sessionErrors: ElementError[];
  progress: LessonProgress | null;
  /** Empty for an anonymous run: no practise link, the SRS has no rows. */
  userId: string;
  t: TFn;
}

/** Renders the lesson-scoped mistakes review in the detailed view. */
export default function LessonReviewReport({
  detailed,
  lesson,
  setId,
  lessonFilename,
  sessionErrors,
  progress,
  userId,
  t,
}: LessonReviewReportProps) {
  const review = useMemo(
    () =>
      buildLessonReview({
        setId,
        lessonId: lessonFilename,
        errors: sessionErrors,
        progress: progress ? [progress] : [],
      }),
    [setId, lessonFilename, sessionErrors, progress],
  );
  if (!detailed) return null;
  return (
    <section
      className="mb-6 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
      data-testid="lesson-summary-review"
    >
      <h3 className="m-0 text-base font-semibold text-fg-primary">
        {t("set_summary.title", "Review: {set}").replace("{set}", lesson.title)}
      </h3>
      <p className="mt-1 text-sm text-fg-muted">
        {t(
          "lesson.summary.review_subtitle",
          "Every mistake in this lesson at a glance",
        )}
      </p>
      <ReviewReport
        review={review}
        t={t}
        testIdPrefix="lesson-summary-review"
        headingLevel={4}
        practiceHref={
          userId && review.hasData
            ? `/review/${encodeURIComponent(setId)}`
            : undefined
        }
      />
    </section>
  );
}
