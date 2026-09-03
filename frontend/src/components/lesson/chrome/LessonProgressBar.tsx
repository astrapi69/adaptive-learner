/**
 * Lesson progress bar (extracted from LessonPage for the complexity
 * burn-down #417).
 *
 * Shows the fill percentage and a "Step n of m" / "Summary" label.
 * Computes its own fill percentage so the parent doesn't carry the
 * ternary. In game mode (#2874, ``playful``) the bar additionally
 * carries checkpoint dots at one and two thirds that light up with
 * a small pop when the fill crosses them - decorative only, the
 * fill and label are unchanged.
 */

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useI18n } from "../../../hooks/ui/useI18n";
import { emitCelebration } from "../../../lib/praise/celebration-bus";

/** #2874 — checkpoint positions as fractions of the lesson. */
const CHECKPOINTS = [1 / 3, 2 / 3];

interface LessonProgressBarProps {
  isSummary: boolean;
  currentStepIndex: number;
  totalSteps: number;
  /** Game-mode juice (#2874): render the checkpoint dots. */
  playful?: boolean;
  /** Extra utility classes (e.g. sticky positioning from the page). */
  className?: string;
}

/** The step-progress bar with its accessible label. */
export default function LessonProgressBar({
  isSummary,
  currentStepIndex,
  totalSteps,
  playful = false,
  className,
}: LessonProgressBarProps) {
  const { t } = useI18n();
  const progressPct =
    totalSteps === 0 ? 100 : Math.round((currentStepIndex / totalSteps) * 100);

  // #2875 — crossing a checkpoint emits one celebration event (the
  // game-mode jingle; sound self-gates on the sound preferences).
  // Backwards navigation lowers the count without re-emitting.
  const showCheckpoints = playful && !isSummary && totalSteps >= 3;
  const reachedCount = showCheckpoints
    ? CHECKPOINTS.filter(
        (fraction) => currentStepIndex / totalSteps >= fraction,
      ).length
    : 0;
  const prevReached = useRef(reachedCount);
  useEffect(() => {
    if (reachedCount > prevReached.current) {
      emitCelebration({ type: "checkpoint" });
    }
    prevReached.current = reachedCount;
  }, [reachedCount]);

  return (
    <div
      className={cn("lesson-progress-bar", className)}
      role="progressbar"
      aria-valuenow={progressPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t("lesson.progress.aria_label", "Lesson progress")}
      data-testid="lesson-progress-bar"
    >
      <div
        className="lesson-progress-fill"
        style={{ width: `${progressPct}%` }}
      />
      {showCheckpoints &&
        CHECKPOINTS.map((fraction) => {
          const reached = currentStepIndex / totalSteps >= fraction;
          return (
            <span
              key={fraction}
              aria-hidden="true"
              data-testid={`lesson-checkpoint-${Math.round(fraction * 100)}`}
              data-reached={reached}
              style={{ left: `${fraction * 100}%` }}
              className={`absolute top-1/2 z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                reached
                  ? "border-[var(--accent)] bg-[var(--accent)] motion-safe:animate-[lernfunke-pop_500ms_ease-out]"
                  : "border-[var(--border-strong)] bg-[var(--bg-elevated)]"
              }`}
            />
          );
        })}
      <span className="lesson-progress-label">
        {isSummary
          ? t("lesson.progress.summary", "Summary")
          : t("lesson.progress.step_of", "Step {current} of {total}")
              .replace("{current}", String(currentStepIndex + 1))
              .replace("{total}", String(totalSteps))}
      </span>
    </div>
  );
}
