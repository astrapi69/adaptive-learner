/**
 * Lesson progress bar (extracted from LessonPage for the complexity
 * burn-down #417).
 *
 * Shows the fill percentage and a "Step n of m" / "Summary" label.
 * Computes its own fill percentage so the parent doesn't carry the
 * ternary.
 */

import { useI18n } from "../../../hooks/ui/useI18n";

interface LessonProgressBarProps {
  isSummary: boolean;
  currentStepIndex: number;
  totalSteps: number;
}

/** The step-progress bar with its accessible label. */
export default function LessonProgressBar({
  isSummary,
  currentStepIndex,
  totalSteps,
}: LessonProgressBarProps) {
  const { t } = useI18n();
  const progressPct =
    totalSteps === 0 ? 100 : Math.round((currentStepIndex / totalSteps) * 100);

  return (
    <div
      className="lesson-progress-bar"
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
