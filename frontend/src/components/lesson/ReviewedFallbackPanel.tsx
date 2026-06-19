/**
 * Compact locked view for a lesson step completed BEFORE raw answers
 * were persisted (extracted from Lesson.tsx, #404; BUG P1 / Problem 2
 * legacy path).
 *
 * New completions reconstruct the exact exercise visual via the
 * ``reviewed`` prop; this fallback only shows the prompt + the stored
 * score so the learner cannot re-answer it.
 */

import { CheckCircle2 } from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import type { ContentLessonExercise, LessonStepResultStored } from "../../storage/types";

interface ReviewedFallbackPanelProps {
  exercise: ContentLessonExercise;
  stored: LessonStepResultStored | undefined;
}

export default function ReviewedFallbackPanel({
  exercise,
  stored,
}: ReviewedFallbackPanelProps) {
  const { t } = useI18n();
  const correct = stored?.correct ?? 0;
  const total = stored?.total ?? 0;
  const allCorrect = total > 0 && correct === total;
  return (
    <section
      className="lesson-reviewed-fallback"
      data-testid="lesson-reviewed-fallback"
    >
      <p className="lesson-reviewed-prompt">{exercise.prompt}</p>
      <p
        className={`lesson-reviewed-status answer-feedback${
          allCorrect ? " is-correct" : " is-wrong"
        }`}
        data-testid="lesson-reviewed-status"
        data-result={allCorrect ? "correct" : "wrong"}
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        {t("lesson.reviewed.completed", "Completed")} —{" "}
        {t("lesson.summary.score", "Score")}: {correct} / {total}
      </p>
    </section>
  );
}
