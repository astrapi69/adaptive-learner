/**
 * LessonTimedStatus — the timed-mode per-question status strip (#1009):
 * the countdown bar, the carried "+Ns bonus" badge, and the "Time's up!"
 * notice. Self-gated: renders ``null`` unless the lesson is in timed mode on
 * an exercise step (not the summary), so the lesson player drops the
 * ``lessonMode === "timed" && !isSummary && isExerciseStep &&`` guard chain
 * and the two inner conditionals (complexity burn-down, #1047).
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import LessonCountdownBar from "./LessonCountdownBar";
import type { LessonMode } from "../../../lib/learning/lessonModePref";

export interface LessonTimedStatusProps {
  /** The active lesson mode (only ``timed`` renders anything). */
  lessonMode: LessonMode;
  /** True on the end-of-lesson summary screen. */
  isSummary: boolean;
  /** True on a gradeable exercise step. */
  isExerciseStep: boolean;
  /** Whole seconds left on the current question. */
  remainingSeconds: number;
  /** The current question's full countdown length. */
  limitSeconds: number;
  /** Bonus seconds carried into the current question (0 when none). */
  bonusSeconds: number;
  /** True while the "time's up" notice shows before auto-advance. */
  timedOut: boolean;
}

/** The timed-mode countdown + bonus + time-up notice (renders ``null``
 *  outside an active timed exercise step). */
export default function LessonTimedStatus({
  lessonMode,
  isSummary,
  isExerciseStep,
  remainingSeconds,
  limitSeconds,
  bonusSeconds,
  timedOut,
}: LessonTimedStatusProps) {
  const { t } = useI18n();
  if (lessonMode !== "timed" || isSummary || !isExerciseStep) return null;
  return (
    <>
      <LessonCountdownBar remaining={remainingSeconds} total={limitSeconds} />
      {bonusSeconds > 0 && (
        <p
          className="m-0 px-2 text-sm font-medium text-[var(--exercise-correct)]"
          data-testid="lesson-timed-bonus"
        >
          {t("lesson.timed.bonus", "+{n}s bonus").replace(
            "{n}",
            String(bonusSeconds),
          )}
        </p>
      )}
      {timedOut && (
        <p
          className="m-0 px-2 font-semibold text-[var(--exercise-wrong)]"
          role="status"
          data-testid="lesson-timed-timeout"
        >
          {t("lesson.timed.time_up", "Time's up!")}
        </p>
      )}
    </>
  );
}
