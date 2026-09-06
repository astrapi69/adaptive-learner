/**
 * Set-completion review (#2792) — every mistake of one set, in one place.
 *
 * Finishing a set used to end in a trophy card: "all N lessons done", a link
 * back to the set, and not one number about what went wrong. Everything needed
 * for a real review was already recorded per element (error count, mastery,
 * the learner's own wrong answer) and never surfaced set-wide.
 *
 * The page is read-only and storage-agnostic: it pulls the rows through
 * ``getStorage()`` (backend in API mode, IndexedDB in Dexie mode) and hands
 * them to the pure aggregator {@link buildSetReview}, so the maths is tested
 * without a storage mock and the view stays a renderer.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { useI18n } from "../../hooks/ui/useI18n";
import { buildSetReview, type SetReview } from "../../lib/statistics/set-review";
import { readLearnerState } from "../../lib/learning/learnerState";
import PageContainer from "../../shared/layout/PageContainer";
import { getStorage } from "../../storage";

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

export default function SetSummary() {
  const { setId = "" } = useParams();
  const { t } = useI18n();
  const [review, setReview] = useState<SetReview | null>(null);
  const [setTitle, setSetTitle] = useState<string>(setId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!setId) return;
    const userId = readLearnerState().userId;
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const storage = getStorage();
      const [errors, progress] = await Promise.all([
        storage.elementErrors
          .list(userId, { setId, includeMastered: true })
          .catch(() => []),
        storage.lessonProgress.list(userId).catch(() => []),
      ]);
      if (cancelled) return;
      setReview(buildSetReview({ setId, errors, progress }));
      // The title is decoration: a miss leaves the raw id, never an error.
      void storage.contentLoader
        .listSets()
        .then(({ sets }) => {
          if (cancelled) return;
          const match = sets.find((s) => s.id === setId);
          if (match?.title) setSetTitle(match.title);
        })
        .catch(() => undefined);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [setId]);

  if (loading) {
    return (
      <PageContainer>
        <div
          className="flex items-center gap-2 text-fg-muted"
          data-testid="set-summary-loading"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("common.loading", "Loading …")}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <main data-testid="set-summary">
        <h1 className="text-xl font-semibold text-fg-primary">
          {t("set_summary.title", "Review: {set}").replace("{set}", setTitle)}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {t("set_summary.subtitle", "Every mistake in this set at a glance")}
        </p>

        {!review?.hasData ? (
          <p className="mt-6 text-fg-secondary" data-testid="set-summary-empty">
            {t("set_summary.no_errors", "No mistakes recorded - excellent!")}
          </p>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure
                testId="set-summary-total-errors"
                label={t("set_summary.total_errors", "Total mistakes")}
                value={String(review.totalErrors)}
              />
              <Figure
                testId="set-summary-mastered"
                label={t("set_summary.mastered_share", "Mastered")}
                value={`${review.masteredShare}%`}
              />
              <Figure
                testId="set-summary-open"
                label={t("set_summary.elements_open", "Still open")}
                value={String(review.elementsTracked - review.elementsMastered)}
              />
              <Figure
                testId="set-summary-time"
                label={t("set_summary.time_spent", "Time spent")}
                value={`${minutesOf(review.timeSpentSeconds)} min`}
              />
            </section>

            {review.byLesson.length > 0 && (
              <section className="mt-8" data-testid="set-summary-by-lesson">
                <h2 className="text-base font-semibold text-fg-primary">
                  {t("set_summary.by_lesson", "Mistakes per lesson")}
                </h2>
                <ul className="mt-2 flex flex-col gap-1">
                  {review.byLesson.map((lesson) => (
                    <li
                      key={lesson.lessonId}
                      className="flex items-center justify-between gap-3 rounded-app border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate text-fg-primary">
                        {lesson.lessonId}
                      </span>
                      <span className="flex-none text-fg-muted">
                        {t("set_summary.lesson_errors", "{count} mistakes").replace(
                          "{count}",
                          String(lesson.errors),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {review.byType.length > 0 && (
              <section className="mt-8" data-testid="set-summary-by-type">
                <h2 className="text-base font-semibold text-fg-primary">
                  {t("set_summary.by_type", "Mistakes per exercise type")}
                </h2>
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
              <section className="mt-8" data-testid="set-summary-weak-areas">
                <h2 className="text-base font-semibold text-fg-primary">
                  {t("set_summary.weak_areas", "Biggest weak spots")}
                </h2>
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
                        <span className="flex-none text-fg-muted">
                          {t("set_summary.lesson_errors", "{count} mistakes").replace(
                            "{count}",
                            String(area.errorCount),
                          )}
                        </span>
                      </div>
                      {area.correctAnswer && (
                        <div className="mt-1 text-fg-muted">
                          <span className="line-through">{area.lastAnswer}</span>{" "}
                          <span className="text-fg-secondary">
                            {area.correctAnswer}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-8 flex flex-wrap gap-2">
              <Link
                to={`/review/${encodeURIComponent(setId)}`}
                className="inline-flex min-h-11 items-center rounded-app bg-accent px-4 font-semibold text-accent-foreground"
                data-testid="set-summary-practice"
              >
                {t("set_summary.practice_errors", "Practise mistakes")}
              </Link>
              <Link
                to={`/content/set/${encodeURIComponent(setId)}`}
                className="inline-flex min-h-11 items-center rounded-app border border-border px-4 text-fg-primary"
                data-testid="set-summary-back"
              >
                {t("set_summary.back_to_set", "Back to the set")}
              </Link>
            </div>
          </>
        )}
      </main>
    </PageContainer>
  );
}
