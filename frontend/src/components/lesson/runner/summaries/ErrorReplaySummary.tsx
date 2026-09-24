/**
 * ErrorReplaySummary (EXP-052 slice 3, refs #3169).
 *
 * The Error Replay's end-of-round recap, hung into ``LessonRunner``
 * through its ``summary`` render prop: "X/Y correct now", and then either
 * the all-corrected celebration (confetti unless reduced motion, the sole
 * "Back to lesson" auto-focused so Enter activates it natively, #1864) or
 * "Still N errors. Try again?" with the retry of only the still-wrong
 * exercises beside "Back to lesson". Moved out of
 * ``pages/lesson/ErrorReplayLesson.tsx`` unchanged, testids included
 * (``error-replay-summary`` with ``data-all-corrected``,
 * ``error-replay-summary-score``, ``error-replay-summary-retry``,
 * ``error-replay-summary-done``).
 *
 * @example
 * summary={(tallies) => (
 *   <ErrorReplaySummary correct={tallies.correct} total={tallies.total}
 *     stillWrong={source.stillWrong} onRetry={source.retryStillWrong}
 *     onDone={() => navigate(source.backTo)} />
 * )}
 */

import { PartyPopper, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import Confetti from "../../../feedback/Confetti";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { prefersReducedMotion } from "../../../../lib/feedback/feedbackPref";

export interface ErrorReplaySummaryProps {
  correct: number;
  total: number;
  /** Exercises of the round not answered fully correct. */
  stillWrong: number;
  onRetry: () => void;
  onDone: () => void;
}

/** Replay recap: the score, then the celebration or the retry offer. */
export default function ErrorReplaySummary({
  correct,
  total,
  stillWrong,
  onRetry,
  onDone,
}: ErrorReplaySummaryProps) {
  const { t } = useI18n();
  const allCorrected = stillWrong === 0;
  const [showConfetti, setShowConfetti] = useState(() => allCorrected && !prefersReducedMotion());

  return (
    <section
      className={`lesson-summary${allCorrected ? " is-celebrating" : ""}`}
      data-testid="error-replay-summary"
      data-all-corrected={allCorrected ? "true" : "false"}
      aria-label={t("lesson.error_replay.summary_aria", "Retry errors summary")}
    >
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <h2>
        {allCorrected ? (
          <>
            <PartyPopper size={20} aria-hidden="true" />{" "}
            {t("lesson.next_step.errors_corrected", "All errors corrected!")}
          </>
        ) : (
          t("lesson.error_replay.heading", "Retry complete")
        )}
      </h2>
      <p
        className="error-replay-summary-score text-lg font-semibold"
        data-testid="error-replay-summary-score"
      >
        {t("lesson.error_replay.score", "{correct}/{total} correct now!")
          .replace("{correct}", String(correct))
          .replace("{total}", String(total))}
      </p>
      <div className="lesson-summary-actions">
        {allCorrected ? (
          <Button type="button" autoFocus onClick={onDone} data-testid="error-replay-summary-done">
            {t("lesson.error_replay.done", "Back to lesson")}
          </Button>
        ) : (
          <>
            <Button type="button" onClick={onRetry} data-testid="error-replay-summary-retry">
              <RotateCcw size={14} aria-hidden="true" />
              {t("lesson.next_step.still_errors", "Still {count} errors. Try again?").replace(
                "{count}",
                String(stillWrong),
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              data-testid="error-replay-summary-done"
            >
              {t("lesson.error_replay.done", "Back to lesson")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
