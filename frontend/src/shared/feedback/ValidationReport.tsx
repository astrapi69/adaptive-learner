/**
 * ValidationReport — presentational report of an AI content check
 * (EXP-033 / AIV-03). Shows a set summary, an OK count, and a list of
 * the cards that have issues, each with field / problem / suggestion.
 *
 * App-agnostic and props-driven: every label and every already-counted
 * summary string is supplied by the caller; no i18n, storage, or routing
 * imports. Token-backed Tailwind only. Reusable for any "AI reviewed this
 * content" surface — the Content Browser dialog, a cached-report view, a
 * future CI-result panel.
 *
 * @example
 * <ValidationReport
 *   setName="Spanisch A1"
 *   summaryText="Checked 120 cards in 15 lessons"
 *   okText="115 cards OK"
 *   issuesText="5 cards with issues"
 *   allOkText="All cards passed."
 *   problemLabel="Problem"
 *   suggestionLabel="Suggestion"
 *   items={[{cardId: "c1", label: "Lektion 3, libro", issues: [
 *     {field: "front", problem: "Artikel falsch", suggestion: "el libro"}]}]}
 *   testId="ai-validation-report"
 * />
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ValidationReportIssue {
  /** The card field the problem is on ("front" | "back" | "notes" | …). */
  field: string;
  problem: string;
  suggestion: string;
}

export interface ValidationReportItem {
  /** Stable key for the card row. */
  cardId: string;
  /** Human-readable card label (e.g. its front, or "Lektion 3, libro"). */
  label: string;
  issues: ValidationReportIssue[];
}

export interface ValidationReportProps {
  /** Title of the set under review. */
  setName: string;
  /** "Checked N cards in M lessons" — fully composed by the caller. */
  summaryText: string;
  /** "N cards OK" — fully composed by the caller. */
  okText: string;
  /** "N cards with issues" — omit/empty when there are no issues. */
  issuesText?: string;
  /** Shown (with a check icon) when ``items`` is empty. */
  allOkText: string;
  /** Row label before each problem line. */
  problemLabel: string;
  /** Row label before each suggestion line. */
  suggestionLabel: string;
  /** The cards with issues. Empty ⇒ the all-OK state renders. */
  items: readonly ValidationReportItem[];
  testId?: string;
}

/** AI content-check result report. */
export default function ValidationReport({
  setName,
  summaryText,
  okText,
  issuesText,
  allOkText,
  problemLabel,
  suggestionLabel,
  items,
  testId,
}: ValidationReportProps) {
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div>
        <h3 className="text-lg font-semibold text-fg-primary" data-testid="validation-report-set">
          {setName}
        </h3>
        <p className="text-sm text-fg-muted" data-testid="validation-report-summary">
          {summaryText}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 text-sm font-medium text-success"
          data-testid="validation-report-ok"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {okText}
        </span>
        {issuesText && (
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium text-warning"
            data-testid="validation-report-issues-count"
          >
            <AlertTriangle size={16} aria-hidden="true" />
            {issuesText}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface p-3 text-sm text-success"
          data-testid="validation-report-all-ok"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {allOkText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="validation-report-items">
          {items.map((item) => (
            <li
              key={item.cardId}
              className="rounded-md border border-border-subtle bg-bg-surface p-3"
              data-testid={`validation-report-item-${item.cardId}`}
            >
              <p className="font-medium text-fg-primary">{item.label}</p>
              <ul className="mt-1 flex flex-col gap-2">
                {item.issues.map((issue, idx) => (
                  <li key={idx} className="text-sm">
                    <span className="text-fg-muted">
                      {issue.field ? `${issue.field}: ` : ""}
                    </span>
                    <span className="text-error">
                      {problemLabel}: {issue.problem}
                    </span>
                    {issue.suggestion && (
                      <span className="mt-0.5 block text-success">
                        {suggestionLabel}: {issue.suggestion}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
