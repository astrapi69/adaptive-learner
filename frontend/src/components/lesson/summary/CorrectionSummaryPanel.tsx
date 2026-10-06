/**
 * The correction summary (#3575): what the learner corrected after a
 * lesson run, shown at the end of the correction round and of Retry
 * errors (and, in the detailed view, on the lesson summary).
 *
 * A first-try line, "{corrected} of {total} corrected", then every
 * mistake of the run with its status, the first answer against the
 * correct one (the same ``AnswerDiff`` "Why you missed these" uses), and
 * the exercise's explanation while it is still open. The data comes from
 * ``buildCorrectionSummary``; this component only renders it. Renders
 * nothing for a run without mistakes.
 *
 * @example
 * <CorrectionSummaryPanel
 *   summary={buildCorrectionSummary(collectRunMistakes(lesson, progress), sessionErrors)}
 *   t={t} />
 */

import { CheckCircle2, CircleDashed } from "lucide-react";

import AnswerDiff from "../../../shared/data-display/AnswerDiff";
import type {
  CorrectionSummary,
  CorrectionSummaryEntry,
} from "../../../lib/lesson/correction/correction-summary";

type TFn = (key: string, fallback?: string) => string;

export interface CorrectionSummaryPanelProps {
  summary: CorrectionSummary;
  t: TFn;
}

/** The run's corrections, or nothing for a clean run. */
export default function CorrectionSummaryPanel({ summary, t }: CorrectionSummaryPanelProps) {
  if (summary.total === 0) return null;
  return (
    <section
      className="mt-4 flex flex-col gap-3"
      data-testid="correction-summary"
      aria-label={t("lesson.correction.summary_heading", "Your corrections")}
    >
      <h3 className="text-base font-semibold text-fg-primary">
        {t("lesson.correction.summary_heading", "Your corrections")}
      </h3>
      <p className="text-sm text-fg-muted" data-testid="correction-summary-first-try">
        {t("lesson.correction.first_try", "First try: {correct} of {total} correct")
          .replace("{correct}", String(summary.firstTry.correct))
          .replace("{total}", String(summary.firstTry.total))}
      </p>
      <p className="text-sm font-medium text-fg-primary" data-testid="correction-summary-count">
        {t("lesson.next_step.error_replay_corrected", "{corrected} of {total} corrected")
          .replace("{corrected}", String(summary.correctedCount))
          .replace("{total}", String(summary.total))}
      </p>
      <ul className="flex list-none flex-col gap-3 p-0">
        {summary.entries.map((entry) => (
          <CorrectionEntry key={entry.stepId} entry={entry} t={t} />
        ))}
      </ul>
    </section>
  );
}

function CorrectionEntry({ entry, t }: { entry: CorrectionSummaryEntry; t: TFn }) {
  const Icon = entry.corrected ? CheckCircle2 : CircleDashed;
  return (
    <li
      className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
      data-testid={`correction-summary-entry-${entry.stepId}`}
      data-corrected={String(entry.corrected)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-fg-primary wrap-anywhere">
          {entry.question ?? entry.title}
        </span>
        <span
          className={
            "inline-flex items-center gap-1 text-sm " +
            (entry.corrected ? "text-[var(--success)]" : "text-[var(--error)]")
          }
        >
          <Icon size={16} aria-hidden="true" />
          {entry.corrected
            ? t("lesson.correction.status_corrected", "Corrected")
            : t("lesson.correction.status_open", "Still open")}
        </span>
      </div>
      {entry.firstAnswer ? (
        <AnswerDiff
          userAnswer={entry.firstAnswer}
          correctAnswer={entry.correctAnswer}
          yourLabel={t("review.your_answer", "Your answer:")}
          correctLabel={t("review.correct_answer", "Correct:")}
        />
      ) : (
        <p className="text-sm text-fg-muted">
          {t("lesson.summary.breakdown_correct_answer", "Correct answer: {answer}").replace(
            "{answer}",
            entry.correctAnswer,
          )}
        </p>
      )}
      {entry.explanation && (
        <p className="text-sm text-fg-secondary" data-testid="correction-summary-explanation">
          {entry.explanation}
        </p>
      )}
    </li>
  );
}
