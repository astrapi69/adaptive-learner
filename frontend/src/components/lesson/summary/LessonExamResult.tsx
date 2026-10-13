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
 * #3736 - when the set declares an ``evaluation`` block, the author's
 * verdict replaces the learner's threshold: passed / not passed with the
 * author's mark (``pass_fail``), the grade label (``grades``) or the percent
 * with an advisory mark (``percent``), under the block's title, with a note
 * that the set's own rules applied.
 *
 * Pure presentational: every value is derived by the parent
 * (``LessonSummary``) and passed in; the retry handler reuses the
 * summary's existing ``onRepeat`` (restart-as-fresh-attempt).
 */

import { Check, RotateCcw, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { AuthorEvaluationResult } from "../../../lib/lesson/summary/author-evaluation";

type TFn = ReturnType<typeof useI18n>["t"];

export interface LessonExamResultProps {
  examPass: boolean;
  examThreshold: number;
  /** #3736 - the set's evaluation applied to this run; replaces the
   *  learner's threshold when present. */
  authorEvaluation?: AuthorEvaluationResult | null;
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

/** A percent as the learner reads it: at most one decimal, no trailing zero. */
function formatPercent(percent: number): string {
  return String(Math.round(percent * 10) / 10);
}

/** Passed / Not passed with the mark it was measured against. */
function PassVerdict({
  passed,
  mark,
  t,
  testId,
}: {
  passed: boolean;
  mark: number;
  t: TFn;
  testId: string;
}) {
  return (
    <p
      className={cn(
        "m-0 flex items-center gap-2 text-lg font-bold",
        passed ? "text-[var(--exercise-correct)]" : "text-[var(--exercise-wrong)]",
      )}
      data-testid={testId}
    >
      {passed ? <Check size={22} aria-hidden="true" /> : <X size={22} aria-hidden="true" />}
      {passed ? t("lesson.exam.passed", "Passed") : t("lesson.exam.not_passed", "Not passed")}
      <span className="text-sm font-normal text-fg-muted">
        {t("lesson.exam.threshold_hint", "(pass ≥ {pct}%)").replace("{pct}", String(mark))}
      </span>
    </p>
  );
}

/** The grade a run earned under a ``grades`` scheme, or that it reached none. */
function GradeVerdict({ result, t }: { result: AuthorEvaluationResult; t: TFn }) {
  const grade = result.outcome.grade;
  const label = grade
    ? t("lesson.exam.grade", "Grade: {grade}").replace(
        "{grade}",
        grade.label_native ? `${grade.label} (${grade.label_native})` : grade.label,
      )
    : t("lesson.exam.no_grade", "No grade reached");
  return (
    <p className="m-0 text-lg font-bold text-fg-primary" data-testid="lesson-exam-result-verdict">
      {label}
    </p>
  );
}

/** The run's percent under a ``percent`` scheme, plus the advisory mark. */
function PercentVerdict({ result, t }: { result: AuthorEvaluationResult; t: TFn }) {
  const { passed } = result.outcome;
  return (
    <>
      <p className="m-0 text-lg font-bold text-fg-primary" data-testid="lesson-exam-result-verdict">
        {t("lesson.exam.percent_result", "{pct}% correct").replace(
          "{pct}",
          formatPercent(result.percent),
        )}
      </p>
      {passed !== undefined && result.passPercent !== null && (
        <p className="m-0 mt-1 text-sm text-fg-secondary" data-testid="lesson-exam-result-advisory">
          {(passed
            ? t("lesson.exam.advisory_reached", "Recommended mark of {pct}% reached")
            : t("lesson.exam.advisory_missed", "Recommended mark of {pct}% not reached")
          ).replace("{pct}", String(result.passPercent))}
        </p>
      )}
    </>
  );
}

/** The author's verdict, by scheme (#3736). */
function AuthorVerdict({ result, t }: { result: AuthorEvaluationResult; t: TFn }) {
  const { scheme, passed } = result.outcome;
  if (scheme === "grades") {
    return (
      <>
        <GradeVerdict result={result} t={t} />
        {passed !== undefined && result.passPercent !== null && (
          <div className="mt-1">
            <PassVerdict passed={passed} mark={result.passPercent} t={t} testId="lesson-exam-result-pass" />
          </div>
        )}
      </>
    );
  }
  if (scheme === "pass_fail" && passed !== undefined && result.passPercent !== null) {
    return (
      <PassVerdict passed={passed} mark={result.passPercent} t={t} testId="lesson-exam-result-verdict" />
    );
  }
  return <PercentVerdict result={result} t={t} />;
}

/** Prominent exam result card (verdict + score + time + XP + retry). */
export default function LessonExamResult({
  examPass,
  examThreshold,
  authorEvaluation = null,
  correct,
  total,
  scorePct,
  minutes,
  xpGain,
  bonusPct,
  onRetry,
}: LessonExamResultProps) {
  const { t } = useI18n();
  const heading = authorEvaluation?.title ?? t("lesson.exam.result_title", "Exam result");
  // Under ``percent`` the author's mark is advisory, so it is no verdict.
  const passed = authorEvaluation
    ? authorEvaluation.outcome.scheme === "percent"
      ? undefined
      : authorEvaluation.outcome.passed
    : examPass;

  return (
    <section
      className="w-full rounded-lg border border-border bg-bg-surface p-4 text-left"
      data-testid="lesson-exam-result"
      data-passed={passed}
      data-evaluation-source={authorEvaluation ? "author" : "learner"}
      aria-label={heading}
    >
      <h3 className="mt-0 mb-3 text-sm font-semibold uppercase tracking-wide text-fg-secondary">
        {heading}
      </h3>

      {authorEvaluation ? (
        <>
          <AuthorVerdict result={authorEvaluation} t={t} />
          <p className="m-0 mt-2 text-xs text-fg-muted" data-testid="lesson-exam-result-source">
            {t(
              "lesson.exam.author_source",
              "Evaluated by this set's own rules, not your own pass threshold",
            )}
          </p>
        </>
      ) : (
        <PassVerdict
          passed={examPass}
          mark={examThreshold}
          t={t}
          testId="lesson-exam-result-verdict"
        />
      )}

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
