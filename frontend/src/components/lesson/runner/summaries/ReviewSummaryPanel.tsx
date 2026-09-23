/**
 * ReviewSummaryPanel (EXP-052 slice 1, refs #3169).
 *
 * The review session's end-of-run summary, hung into ``LessonRunner``
 * through its ``summary`` render prop: the shared presentational
 * ``ReviewSummary`` with the review wording (#3170: "corrected" for an
 * errors-only round, "reinforced" with the neutral trend line once the
 * round held never-wrong elements), the SRS note, the "another round"
 * offer while elements are still due (#718) and the come-back line
 * (#626). Moved out of ``pages/lesson/Review.tsx`` unchanged, testids
 * included (``review-summary``, ``review-summary-another``,
 * ``review-another-round``, ``review-summary-repeat``).
 *
 * @example
 * summary={(tallies) => (
 *   <ReviewSummaryPanel
 *     correct={tallies.correct}
 *     total={tallies.total}
 *     remaining={tallies.remaining ?? 0}
 *     neutral={source.neutral}
 *     onAnotherRound={source.reload}
 *     onExit={() => navigate("/dashboard")}
 *   />
 * )}
 */

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../../hooks/ui/useI18n";
import ReviewSummaryView from "../../../../shared/gamification/ReviewSummary";

export interface ReviewSummaryPanelProps {
  correct: number;
  total: number;
  /** #718: elements still due that didn't fit this round. */
  remaining: number;
  /** #3170: the round held never-wrong elements (the Settings > Learning
   *  toggle): say "reinforced", not "corrected", and drop the "weak spots"
   *  trend line. */
  neutral?: boolean;
  onAnotherRound: () => void;
  onExit: () => void;
}

/** The review recap with the SRS note, the another-round offer and the repeat hint. */
export default function ReviewSummaryPanel({
  correct,
  total,
  remaining,
  neutral = false,
  onAnotherRound,
  onExit,
}: ReviewSummaryPanelProps) {
  const { t } = useI18n();
  const correctedLabel = neutral
    ? t("review.summary_reinforced", "{corrected} of {total} reinforced")
    : t("review.summary_corrected", "{corrected} of {total} corrected");
  const trendLabel = neutral
    ? t("review.summary_trend_reinforced", "Good - this is settling in.")
    : t("review.summary_trend", "Nice - your weak spots are getting stronger.");
  return (
    <ReviewSummaryView
      heading={t("review.summary.heading", "Review complete")}
      corrected={correct}
      total={total}
      correctedLabel={correctedLabel
        .replace("{corrected}", String(correct))
        .replace("{total}", String(total))}
      trendLabel={correct > 0 ? trendLabel : undefined}
      nextReviewLabel={t(
        "review.summary_next",
        "Mastered items drop out; the rest return for review soon.",
      )}
      exitLabel={t("review.back_to_dashboard", "Back to Dashboard")}
      onExit={onExit}
      testId="review-summary"
    >
      <p className="review-summary-note text-sm text-fg-muted">
        {t(
          "review.summary.note",
          "Element scores have been updated. Mastered elements will not appear in the next session.",
        )}
      </p>
      {remaining > 0 && (
        <div className="mt-2 flex flex-col items-start gap-2" data-testid="review-summary-another">
          <p className="review-summary-note text-sm text-fg-muted">
            {t("review.summary_remaining", "Still {n} due. Keep going?").replace(
              "{n}",
              String(remaining),
            )}
          </p>
          <Button type="button" onClick={onAnotherRound} data-testid="review-another-round">
            <RotateCcw size={14} aria-hidden="true" />
            {t("review.another_round", "Another round")}
          </Button>
        </div>
      )}
      <p className="review-summary-note text-sm text-fg-muted" data-testid="review-summary-repeat">
        {t("review.summary_repeat", "Come back in about 2 days to keep these fresh.")}
      </p>
    </ReviewSummaryView>
  );
}
