/**
 * AiFixReview (AIV-07, #3060): the review table of the AI check's
 * "Apply suggestions" step. One row per applicable replacement with the
 * current and the suggested value side by side and a tick the learner
 * can take away; findings without an applicable value are counted below
 * the table, never written. Presentational: the plan, the selection and
 * every label come from the caller.
 *
 * @example
 * <AiFixReview plan={plan} selected={selected} onToggle={toggle} labels={labels} />
 */

import type { FixPlan } from "../../../lib/content/validation/ai-fix";

export interface AiFixReviewLabels {
  intro: string;
  lesson: string;
  card: string;
  field: string;
  current: string;
  suggested: string;
  /** Fully composed "{count} findings ... stay manual" line, or null when none. */
  manualCount: string | null;
  noneApplicable: string;
}

export interface AiFixReviewProps {
  plan: FixPlan;
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  labels: AiFixReviewLabels;
  /** `data-testid` of the root; rows and ticks derive from it. */
  testId?: string;
}

const HEAD_CELL = "px-2 py-1 text-left text-xs font-medium uppercase text-fg-muted";
const CELL = "px-2 py-1 align-top";

export default function AiFixReview({
  plan,
  selected,
  onToggle,
  labels,
  testId = "ai-fix-review",
}: AiFixReviewProps) {
  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      <p className="m-0 text-sm text-fg-secondary">{labels.intro}</p>
      {plan.candidates.length === 0 ? (
        <p data-testid={`${testId}-none`} className="m-0 text-sm text-fg-muted">
          {labels.noneApplicable}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-app border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={HEAD_CELL} scope="col" />
                <th className={HEAD_CELL} scope="col">{labels.lesson}</th>
                <th className={HEAD_CELL} scope="col">{labels.card}</th>
                <th className={HEAD_CELL} scope="col">{labels.field}</th>
                <th className={HEAD_CELL} scope="col">{labels.current}</th>
                <th className={HEAD_CELL} scope="col">{labels.suggested}</th>
              </tr>
            </thead>
            <tbody>
              {plan.candidates.map((candidate) => (
                <tr
                  key={candidate.key}
                  data-testid={`${testId}-row-${candidate.key}`}
                  className="border-b border-border last:border-b-0"
                >
                  <td className={CELL}>
                    <input
                      type="checkbox"
                      data-testid={`${testId}-check-${candidate.key}`}
                      aria-label={`${candidate.front}: ${candidate.field}`}
                      checked={selected.has(candidate.key)}
                      onChange={() => onToggle(candidate.key)}
                    />
                  </td>
                  <td className={`${CELL} text-fg-muted`}>{candidate.lessonTitle}</td>
                  <td className={`${CELL} font-medium text-fg-primary`}>{candidate.front}</td>
                  <td className={`${CELL} text-fg-muted`}>{candidate.field}</td>
                  <td className={`${CELL} text-fg-secondary`}>{candidate.before || "-"}</td>
                  <td className={`${CELL} text-fg-primary`}>{candidate.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {labels.manualCount ? (
        <p data-testid={`${testId}-manual`} className="m-0 text-xs text-fg-muted">
          {labels.manualCount}
        </p>
      ) : null}
    </div>
  );
}
