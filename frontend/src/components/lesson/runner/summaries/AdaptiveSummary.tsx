/**
 * AdaptiveSummary (EXP-052 slice 3, refs #3169).
 *
 * The adaptive lesson's end-of-run recap, hung into ``LessonRunner``
 * through its ``summary`` render prop: the score with its percentage, the
 * improvement line when elements flipped to mastered during the session
 * (F-116, the delta the source's one-time ``finalize`` computes), the SRS
 * note, the exit, and below it the save-for-replay row (Phase 59F,
 * ``SaveAdaptiveLessonButton``). Moved out of
 * ``pages/lesson/AdaptiveLesson.tsx`` unchanged, testids included
 * (``adaptive-lesson-summary``, ``adaptive-summary-score``,
 * ``adaptive-summary-mastered-delta``, ``adaptive-summary-exit``,
 * ``adaptive-save-row``).
 *
 * @example
 * summary={(tallies) => (
 *   <AdaptiveSummary correct={tallies.correct} total={tallies.total}
 *     masteredDelta={tallies.masteredDelta ?? null} lesson={source.lesson}
 *     onExit={() => navigate("/dashboard")} />
 * )}
 */

import { TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import SaveAdaptiveLessonButton from "../../../content/lessons/SaveAdaptiveLessonButton";
import { useI18n } from "../../../../hooks/ui/useI18n";
import type { ContentLesson } from "../../../../storage/types";

export interface AdaptiveSummaryProps {
  correct: number;
  total: number;
  /** F-116: elements mastered during this session, ``null`` until known. */
  masteredDelta: number | null;
  /** The generated lesson the save row stores for replay; none, no row. */
  lesson: ContentLesson | null;
  onExit: () => void;
}

/** Adaptive recap: score, mastery improvement, SRS note, exit, save row. */
export default function AdaptiveSummary({
  correct,
  total,
  masteredDelta,
  lesson,
  onExit,
}: AdaptiveSummaryProps) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <>
      <section
        className="lesson-summary"
        data-testid="adaptive-lesson-summary"
        aria-label={t("adaptive.summary.aria_label", "Adaptive lesson summary")}
      >
        <h2>{t("adaptive.summary.heading", "Adaptive lesson complete")}</h2>
        <ul className="lesson-summary-stats">
          <li>
            <strong>{t("adaptive.summary.score", "Score")}:</strong>{" "}
            <span data-testid="adaptive-summary-score">
              {correct} / {total} ({pct}%)
            </span>
          </li>
        </ul>
        {masteredDelta !== null && masteredDelta > 0 && (
          <p
            className="adaptive-summary-improvement flex items-center gap-1 text-sm text-[var(--success-fg,var(--accent))]"
            data-testid="adaptive-summary-mastered-delta"
          >
            <TrendingUp size={14} aria-hidden="true" />
            {t(
              "adaptive.summary.mastered_delta",
              "Improvement: +{n} element(s) mastered this session!",
            ).replace("{n}", String(masteredDelta))}
          </p>
        )}
        <p className="review-summary-note text-sm text-fg-muted">
          {t(
            "adaptive.summary.note",
            "Element scores have been updated. Your next adaptive lesson will target the elements that still need work.",
          )}
        </p>
        <div className="lesson-summary-actions">
          <Button type="button" onClick={onExit} data-testid="adaptive-summary-exit">
            {t("adaptive.back_to_dashboard", "Back to Dashboard")}
          </Button>
        </div>
      </section>
      {lesson && (
        <div className="adaptive-save-row mt-4 flex justify-center" data-testid="adaptive-save-row">
          <SaveAdaptiveLessonButton lesson={lesson} />
        </div>
      )}
    </>
  );
}
