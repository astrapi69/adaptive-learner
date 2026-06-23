/**
 * Dedicated end-of-exam result panel (#1007 Phase 2).
 *
 * Shown at the top of the lesson summary when the run was played in exam
 * mode. Consolidates the exam outcome into one prominent card: the
 * Passed / Not-passed verdict against the configured threshold, the
 * score, the time, the XP earned (with the exam-bonus note), and a
 * "Retry exam" action. The per-exercise breakdown ("view all answers")
 * stays below in the shared summary.
 *
 * Pure presentational: every value is derived by the parent
 * (``LessonSummary``) and passed in; the retry handler reuses the
 * summary's existing ``onRepeat`` (restart-as-fresh-attempt).
 */

import { Check, RotateCcw, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "../../../hooks/ui/useI18n";

export interface LessonExamResultProps {
  examPass: boolean;
  examThreshold: number;
  correct: number;
  total: number;
  scorePct: number;
  minutes: number;
  xpGain: number;
  /** Exam reward weight as a percent bonus (e.g. 50 for 1.5×); 0 hides
   *  the bonus note. */
  bonusPct: number;
  onRetry: () => void;
}

/** Prominent exam result card (verdict + score + time + XP + retry). */
export default function LessonExamResult({
  examPass,
  examThreshold,
  correct,
  total,
  scorePct,
  minutes,
  xpGain,
  bonusPct,
  onRetry,
}: LessonExamResultProps) {
  const { t } = useI18n();

  return (
    <section
      className="w-full rounded-lg border border-border bg-bg-surface p-4 text-left"
      data-testid="lesson-exam-result"
      data-passed={examPass}
      aria-label={t("lesson.exam.result_title", "Exam result")}
    >
      <h3 className="mt-0 mb-3 text-sm font-semibold uppercase tracking-wide text-fg-secondary">
        {t("lesson.exam.result_title", "Exam result")}
      </h3>

      <p
        className={cn(
          "m-0 flex items-center gap-2 text-lg font-bold",
          examPass
            ? "text-[var(--exercise-correct)]"
            : "text-[var(--exercise-wrong)]",
        )}
        data-testid="lesson-exam-result-verdict"
      >
        {examPass ? (
          <Check size={22} aria-hidden="true" />
        ) : (
          <X size={22} aria-hidden="true" />
        )}
        {examPass
          ? t("lesson.exam.passed", "Passed")
          : t("lesson.exam.not_passed", "Not passed")}
        <span className="text-sm font-normal text-fg-muted">
          {t("lesson.exam.threshold_hint", "(pass ≥ {pct}%)").replace(
            "{pct}",
            String(examThreshold),
          )}
        </span>
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-muted">
            {t("lesson.summary.score", "Score")}
          </dt>
          <dd
            className="m-0 font-semibold text-fg-primary"
            data-testid="lesson-exam-result-score"
          >
            {correct} / {total} ({scorePct}%)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">
            {t("lesson.summary.time", "Time")}
          </dt>
          <dd className="m-0 font-semibold text-fg-primary">
            {t("lesson.summary.minutes", "{n} min").replace(
              "{n}",
              String(minutes),
            )}
          </dd>
        </div>
        {xpGain > 0 && (
          <div>
            <dt className="text-xs text-fg-muted">
              {t("gamification.xp_earned", "XP earned")}
            </dt>
            <dd
              className="m-0 flex items-center gap-1 font-semibold text-fg-primary"
              data-testid="lesson-exam-result-xp"
            >
              <Zap size={16} aria-hidden="true" />+{xpGain}{" "}
              {t("gamification.xp", "XP")}
              {bonusPct > 0 && (
                <span className="text-xs font-normal text-[var(--exercise-correct)]">
                  {t("lesson.exam.xp_bonus", "incl. {pct}% exam bonus").replace(
                    "{pct}",
                    String(bonusPct),
                  )}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onRetry}
        data-testid="lesson-exam-result-retry"
      >
        <RotateCcw size={18} aria-hidden="true" />
        {t("lesson.exam.retry", "Retry exam")}
      </Button>
    </section>
  );
}
