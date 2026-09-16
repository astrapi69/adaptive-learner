/**
 * ReviewReport - the mistakes review of one set or one lesson (#2792, #3124).
 *
 * The renderer behind the set-completion page and, since #3124, the detailed
 * end-of-lesson evaluation: the four key figures, mistakes per lesson (set
 * scope only), mistakes per exercise type, the weak spots with the learner's
 * own wrong answer, and the practise / back actions. One renderer for both
 * scopes so the two views can never drift apart; the scope decides through
 * props (``showByLesson``, the heading level, the testid prefix, which action
 * links exist), never through a second copy of the markup.
 *
 * Props-driven: the review comes pre-aggregated ({@link buildSetReview} /
 * {@link buildLessonReview}), i18n arrives as the ``t`` function, and every
 * ``data-testid`` derives from ``testIdPrefix`` so the set page keeps its
 * ``set-summary-*`` ids.
 *
 * @example
 * <ReviewReport review={review} t={t} testIdPrefix="set-summary"
 *   showByLesson practiceHref={`/review/${setId}`} backHref={`/content/set/${setId}`} />
 */

import { Link } from "react-router";

import type { SetReview } from "../../lib/statistics/set-review";

type TFn = (key: string, fallback?: string) => string;

interface ReviewReportProps {
  /** The aggregated review; ``null`` (no learner) renders the empty state. */
  review: SetReview | null;
  t: TFn;
  /** Prefix of every ``data-testid`` (``set-summary``, ``lesson-summary-review``). */
  testIdPrefix: string;
  /** Render the per-lesson breakdown (set scope). A lesson-scoped report has
   *  exactly one lesson and skips it. */
  showByLesson?: boolean;
  /** Heading level of the report sections: 2 on the set page (under its h1),
   *  4 inside the lesson summary (under the panel's h2 and the report's h3). */
  headingLevel?: 2 | 3 | 4;
  /** Route of the "Practise mistakes" action; omitted renders no button. */
  practiceHref?: string;
  /** Route of the "Back to the set" action; omitted renders no button. */
  backHref?: string;
}

/** Whole-minute rendering of a second count ("47 min"). */
function minutesOf(seconds: number): number {
  return Math.round(seconds / 60);
}

/** One headline figure. */
function Figure({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-app border border-border bg-bg-elevated px-4 py-3"
      data-testid={testId}
    >
      <span className="text-2xl font-semibold text-fg-primary">{value}</span>
      <span className="text-sm text-fg-muted">{label}</span>
    </div>
  );
}

/** Renders the review sections for one set or one lesson. */
export default function ReviewReport({
  review,
  t,
  testIdPrefix,
  showByLesson = false,
  headingLevel = 2,
  practiceHref,
  backHref,
}: ReviewReportProps) {
  const Heading = `h${headingLevel}` as const;
  const headingClass = "text-base font-semibold text-fg-primary";
  const mistakes = (count: number) =>
    t("set_summary.lesson_errors", "{count} mistakes").replace(
      "{count}",
      String(count),
    );

  if (!review?.hasData) {
    return (
      <p className="mt-6 text-fg-secondary" data-testid={`${testIdPrefix}-empty`}>
        {t("set_summary.no_errors", "No mistakes recorded - excellent!")}
      </p>
    );
  }

  return (
    <div data-testid={`${testIdPrefix}-report`}>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          testId={`${testIdPrefix}-total-errors`}
          label={t("set_summary.total_errors", "Total mistakes")}
          value={String(review.totalErrors)}
        />
        <Figure
          testId={`${testIdPrefix}-mastered`}
          label={t("set_summary.mastered_share", "Mastered")}
          value={`${review.masteredShare}%`}
        />
        <Figure
          testId={`${testIdPrefix}-open`}
          label={t("set_summary.elements_open", "Still open")}
          value={String(review.elementsTracked - review.elementsMastered)}
        />
        <Figure
          testId={`${testIdPrefix}-time`}
          label={t("set_summary.time_spent", "Time spent")}
          value={`${minutesOf(review.timeSpentSeconds)} min`}
        />
      </section>

      {showByLesson && review.byLesson.length > 0 && (
        <section className="mt-8" data-testid={`${testIdPrefix}-by-lesson`}>
          <Heading className={headingClass}>
            {t("set_summary.by_lesson", "Mistakes per lesson")}
          </Heading>
          <ul className="mt-2 flex flex-col gap-1">
            {review.byLesson.map((lesson) => (
              <li
                key={lesson.lessonId}
                className="flex items-center justify-between gap-3 rounded-app border border-border px-3 py-2 text-sm"
              >
                <span className="truncate text-fg-primary">{lesson.lessonId}</span>
                <span className="flex-none text-fg-muted">{mistakes(lesson.errors)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.byType.length > 0 && (
        <section className="mt-8" data-testid={`${testIdPrefix}-by-type`}>
          <Heading className={headingClass}>
            {t("set_summary.by_type", "Mistakes per exercise type")}
          </Heading>
          <ul className="mt-2 flex flex-wrap gap-2">
            {review.byType.map((entry) => (
              <li
                key={entry.type}
                className="rounded-app border border-border px-3 py-1 text-sm text-fg-secondary"
              >
                {t(`set_summary.element_type.${entry.type}`, entry.type)}:{" "}
                {entry.errors}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.weakAreas.length > 0 && (
        <section className="mt-8" data-testid={`${testIdPrefix}-weak-areas`}>
          <Heading className={headingClass}>
            {t("set_summary.weak_areas", "Biggest weak spots")}
          </Heading>
          <ul className="mt-2 flex flex-col gap-2">
            {review.weakAreas.map((area) => (
              <li
                key={`${area.lessonId}#${area.elementKey}`}
                className="rounded-app border border-border px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-fg-primary">
                    {area.elementKey}
                  </span>
                  <span className="flex-none text-fg-muted">{mistakes(area.errorCount)}</span>
                </div>
                {area.correctAnswer && (
                  <div className="mt-1 text-fg-muted">
                    <span className="line-through">{area.lastAnswer}</span>{" "}
                    <span className="text-fg-secondary">{area.correctAnswer}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(practiceHref || backHref) && (
        <div className="mt-8 flex flex-wrap gap-2">
          {practiceHref && (
            <Link
              to={practiceHref}
              className="inline-flex min-h-11 items-center rounded-app bg-accent px-4 font-semibold text-accent-foreground"
              data-testid={`${testIdPrefix}-practice`}
            >
              {t("set_summary.practice_errors", "Practise mistakes")}
            </Link>
          )}
          {backHref && (
            <Link
              to={backHref}
              className="inline-flex min-h-11 items-center rounded-app border border-border px-4 text-fg-primary"
              data-testid={`${testIdPrefix}-back`}
            >
              {t("set_summary.back_to_set", "Back to the set")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
