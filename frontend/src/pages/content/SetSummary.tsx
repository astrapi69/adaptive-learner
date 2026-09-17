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
 * without a storage mock and the view stays a renderer. The sections
 * themselves are {@link ReviewReport} (#3124), shared with the detailed
 * end-of-lesson evaluation, so the two views never drift apart.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import ReviewReport from "../../components/progress/ReviewReport";
import { useI18n } from "../../hooks/ui/useI18n";
import { buildSetReview, type SetReview } from "../../lib/statistics/set-review";
import { readLearnerState } from "../../lib/learning/learnerState";
import PageContainer from "../../shared/layout/PageContainer";
import { getStorage } from "../../storage";

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

        <ReviewReport
          review={review}
          t={t}
          testIdPrefix="set-summary"
          showByLesson
          practiceHref={`/review/${encodeURIComponent(setId)}`}
          backHref={`/content/set/${encodeURIComponent(setId)}`}
        />
      </main>
    </PageContainer>
  );
}
