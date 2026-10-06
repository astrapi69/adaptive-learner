/**
 * The compact lesson summary's way into the correction round (#3575).
 *
 * Since #3124 the compact default shows only result and XP, so the
 * ``correction`` section is off and a learner with mistakes had nothing
 * that leads to fixing them. This row sits with the always-rendered
 * actions: a "Fix mistakes (n)" button while mistakes of this run are
 * still open, and the "{corrected} of {total} corrected" line once any
 * are corrected. Renders nothing for a clean run. The counts are the ones
 * the correction block shows (``openFailedExercises`` over the live SRS
 * rows), passed in by the summary.
 *
 * @example
 * <SummaryFixMistakes openCount={2} correctedCount={1} totalCount={3}
 *   onFix={() => setFixOpen(true)} t={t} />
 */

import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";

type TFn = (key: string, fallback?: string) => string;

export interface SummaryFixMistakesProps {
  /** Failed exercises of this run that are still open. */
  openCount: number;
  /** Failed exercises of this run that are corrected by now. */
  correctedCount: number;
  /** Every exercise this run failed. */
  totalCount: number;
  /** Open the correction round. */
  onFix: () => void;
  t: TFn;
}

/** The fix-mistakes button plus the corrected count, or nothing. */
export default function SummaryFixMistakes({
  openCount,
  correctedCount,
  totalCount,
  onFix,
  t,
}: SummaryFixMistakesProps) {
  if (totalCount === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {correctedCount > 0 && (
        <p className="text-sm text-fg-muted" data-testid="lesson-summary-corrected-count">
          {t("lesson.next_step.error_replay_corrected", "{corrected} of {total} corrected")
            .replace("{corrected}", String(correctedCount))
            .replace("{total}", String(totalCount))}
        </p>
      )}
      {openCount > 0 && (
        <Button
          type="button"
          className="min-h-11 gap-2"
          onClick={onFix}
          data-testid="lesson-summary-fix-mistakes"
        >
          <Wrench aria-hidden="true" />
          {t("lesson.correction.fix_mistakes", "Fix mistakes ({count})").replace(
            "{count}",
            String(openCount),
          )}
        </Button>
      )}
    </div>
  );
}
