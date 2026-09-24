/**
 * ShuffleSummary (EXP-052 slice 2, refs #3169).
 *
 * The shuffle session's end-of-run recap, hung into ``LessonRunner``
 * through its ``summary`` render prop: the score with its percentage,
 * the "from {n} different lessons" line, "Shuffle again" and the exit.
 * Moved out of ``pages/lesson/ShuffleLesson.tsx`` unchanged, testids
 * included (``shuffle-summary``, ``shuffle-summary-score``,
 * ``shuffle-summary-lessons``, ``shuffle-another-round``,
 * ``shuffle-exit``).
 *
 * @example
 * summary={(tallies) => (
 *   <ShuffleSummary
 *     correct={tallies.correct}
 *     total={tallies.total}
 *     lessons={source.sourceLessonCount}
 *     onAnotherRound={source.reload}
 *     onExit={() => navigate("/dashboard")}
 *   />
 * )}
 */

import { ArrowLeft, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../../hooks/ui/useI18n";

export interface ShuffleSummaryProps {
  correct: number;
  total: number;
  /** How many source lessons the round interleaved. */
  lessons: number;
  onAnotherRound: () => void;
  onExit: () => void;
}

/** Shuffle-session recap: score + "from N lessons" + re-shuffle / exit. */
export default function ShuffleSummary({
  correct,
  total,
  lessons,
  onAnotherRound,
  onExit,
}: ShuffleSummaryProps) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <section
      className="lesson-summary"
      data-testid="shuffle-summary"
      aria-label={t("shuffle.summary.heading", "Shuffle training complete!")}
    >
      <h2>{t("shuffle.summary.heading", "Shuffle training complete!")}</h2>
      <p className="text-lg font-semibold text-fg-primary" data-testid="shuffle-summary-score">
        {t("shuffle.summary.score", "{correct} of {total} correct")
          .replace("{correct}", String(correct))
          .replace("{total}", String(total))}{" "}
        ({pct}%)
      </p>
      <p className="mt-1 text-sm text-fg-muted" data-testid="shuffle-summary-lessons">
        {t("shuffle.summary.from_lessons", "from {n} different lessons").replace(
          "{n}",
          String(lessons),
        )}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={onAnotherRound} data-testid="shuffle-another-round">
          <RotateCcw size={14} aria-hidden="true" />
          {t("shuffle.summary.another", "Shuffle again")}
        </Button>
        <Button type="button" variant="outline" onClick={onExit} data-testid="shuffle-exit">
          <ArrowLeft size={14} aria-hidden="true" />
          {t("shuffle.back_to_dashboard", "Back to Dashboard")}
        </Button>
      </div>
    </section>
  );
}
