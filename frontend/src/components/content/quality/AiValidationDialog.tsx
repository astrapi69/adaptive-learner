/**
 * AiValidationDialog — the EXP-033 set-wide AI content-check flow
 * (AIV-02/03/05): cost estimate → confirm → batched run with progress +
 * cancel → per-card report. Opens for a single cached set.
 *
 * The provider call runs through ``getStorage().contentLoader
 * .aiValidateCards`` (Dexie browser-direct). The trigger is gated to a
 * configured key + Dexie mode by the caller; this dialog still guards
 * defensively and surfaces any error as a friendly message.
 */

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import ProgressBar from "../../../shared/data-display/ProgressBar";
import ValidationReport, {
  type ValidationReportItem,
} from "../../../shared/feedback/ValidationReport";
import { useI18n } from "../../../hooks/ui/useI18n";
import { useAiCardValidation } from "../../../hooks/content/useAiCardValidation";
import {
  buildValidationMarkdown,
  type ValidationMarkdownRow,
} from "../../../lib/ai/validation-markdown";
import { downloadBlob } from "../../../lib/lesson/result-download";
import type { AIProvider } from "../../../lib/constants";
import type { ContentSetEntry } from "../../../storage/types";

export interface AiValidationDialogProps {
  /** The set under review, or null when the dialog is closed. */
  entry: ContentSetEntry | null;
  activeProvider: AIProvider | null;
  onClose: () => void;
}

export default function AiValidationDialog({
  entry,
  activeProvider,
  onClose,
}: AiValidationDialogProps) {
  const { t } = useI18n();
  const { state, rateLimited, begin, recheck, run, abort, reset } =
    useAiCardValidation();

  // Open: load lessons + estimate when a target arrives.
  useEffect(() => {
    if (entry) void begin(entry, activeProvider);
    else reset();
    // begin/reset are stable useCallbacks; entry/activeProvider drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, activeProvider]);

  if (!entry) return null;

  const close = () => {
    reset();
    onClose();
  };

  const reportItems: ValidationReportItem[] = state.issueRows.map((row) => ({
    cardId: row.cardId,
    label: row.lessonTitle ? `${row.lessonTitle} — ${row.front}` : row.front,
    issues: row.result.issues,
  }));

  const progressPct =
    state.progress && state.progress.total > 0
      ? Math.round((state.progress.current / state.progress.total) * 100)
      : 0;

  const handleExportMarkdown = () => {
    const rows: ValidationMarkdownRow[] = state.issueRows.flatMap((row) =>
      row.result.issues.map((issue) => ({
        lessonTitle: row.lessonTitle,
        cardLabel: row.front,
        field: issue.field,
        problem: issue.problem,
        suggestion: issue.suggestion,
      })),
    );
    const markdown = buildValidationMarkdown({
      setName: entry.title,
      summaryLine: t("content.ai_check.report.summary", "Checked {cards} cards in {lessons} lessons")
        .replace("{cards}", String(state.checkedCards))
        .replace("{lessons}", String(state.lessonCount)),
      headers: {
        lesson: t("content.ai_check.export.lesson", "Lesson"),
        card: t("content.ai_check.export.card", "Card"),
        field: t("content.ai_check.export.field", "Field"),
        problem: t("content.ai_check.report.problem", "Problem"),
        suggestion: t("content.ai_check.report.suggestion", "Suggestion"),
      },
      allOkLine: t("content.ai_check.report.all_ok", "All cards passed. No issues found."),
      rows,
    });
    const slug = entry.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadBlob(markdown, `ai-check-${slug}.md`, "text/markdown");
  };

  const formatCheckedAt = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <div className="modal-overlay" data-testid="ai-validation-modal">
      <div
        className="modal-card max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-validation-title"
      >
        <h2 id="ai-validation-title" className="modal-title">
          {t("content.ai_check.title", "AI content check")}
        </h2>
        <p className="text-sm text-fg-muted">{entry.title}</p>

        {/* Loading the set's lessons (before the estimate is ready). */}
        {state.phase === "running" && !state.estimate && !state.progress && (
          <p className="mt-4 text-sm text-fg-secondary" data-testid="ai-validation-loading">
            {t("content.ai_check.loading", "Preparing cards…")}
          </p>
        )}

        {/* Cost estimate + privacy + confirmation. */}
        {state.phase === "confirm" && state.estimate && (
          <div className="mt-4 flex flex-col gap-3" data-testid="ai-validation-confirm">
            <p className="text-sm text-fg-primary" data-testid="ai-validation-estimate">
              {t(
                "content.ai_check.cost_estimate",
                "~{cards} cards, ~{tokens} tokens, ~{usd}.",
              )
                .replace("{cards}", String(state.estimate.cardCount))
                .replace("{tokens}", state.estimate.tokensLabel)
                .replace("{usd}", state.estimate.usdLabel)}
            </p>
            <p className="text-xs text-fg-muted">
              {t(
                "content.ai_check.privacy",
                "Your lesson cards will be sent to your configured AI provider for review. No personal data is transmitted.",
              )}
            </p>
            {rateLimited && (
              <p className="text-sm text-warning" data-testid="ai-validation-rate-limited">
                {t(
                  "content.ai_check.rate_limited",
                  "Please wait a moment before running another check.",
                )}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                data-testid="ai-validation-cancel"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void run()}
                disabled={state.estimate.cardCount === 0}
                data-testid="ai-validation-confirm-run"
              >
                {t("content.ai_check.confirm", "Check")}
              </Button>
            </div>
          </div>
        )}

        {/* In-flight batched run with progress + cancel. */}
        {state.phase === "running" && state.progress && (
          <div className="mt-4 flex flex-col gap-3" data-testid="ai-validation-progress">
            <ProgressBar
              valueNow={progressPct}
              ariaLabel={t("content.ai_check.title", "AI content check")}
              className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated"
              fillClassName="h-full bg-accent transition-all"
              testId="ai-validation-progress-bar"
            />
            <p className="text-sm text-fg-secondary">
              {t("content.ai_check.progress", "Checking batch {current} of {total}…")
                .replace("{current}", String(state.progress.current))
                .replace("{total}", String(state.progress.total))}
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={abort}
                data-testid="ai-validation-abort"
              >
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Final report. */}
        {state.phase === "done" && (
          <div className="mt-4 flex flex-col gap-4">
            {state.cached && state.checkedAt && (
              <p
                className="text-xs text-fg-muted"
                data-testid="ai-validation-last-checked"
              >
                {t("content.ai_check.last_checked", "Last check: {when}").replace(
                  "{when}",
                  formatCheckedAt(state.checkedAt),
                )}
              </p>
            )}
            <ValidationReport
              setName={entry.title}
              summaryText={t(
                "content.ai_check.report.summary",
                "Checked {cards} cards in {lessons} lessons",
              )
                .replace("{cards}", String(state.checkedCards))
                .replace("{lessons}", String(state.lessonCount))}
              okText={t("content.ai_check.report.ok", "{count} cards OK").replace(
                "{count}",
                String(state.okCount),
              )}
              issuesText={
                reportItems.length > 0
                  ? t("content.ai_check.report.issues", "{count} cards with issues").replace(
                      "{count}",
                      String(reportItems.length),
                    )
                  : undefined
              }
              allOkText={t(
                "content.ai_check.report.all_ok",
                "All cards passed — no issues found.",
              )}
              problemLabel={t("content.ai_check.report.problem", "Problem")}
              suggestionLabel={t("content.ai_check.report.suggestion", "Suggestion")}
              items={reportItems}
              testId="ai-validation-report"
            />
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportMarkdown}
                data-testid="ai-validation-export-md"
              >
                {t("content.ai_check.export.button", "Export report as Markdown")}
              </Button>
              {state.cached && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={recheck}
                  data-testid="ai-validation-recheck"
                >
                  {t("content.ai_check.recheck", "Re-check")}
                </Button>
              )}
              <Button type="button" onClick={close} data-testid="ai-validation-close">
                {t("common.close", "Close")}
              </Button>
            </div>
          </div>
        )}

        {/* Error. */}
        {state.phase === "error" && (
          <div className="mt-4 flex flex-col gap-3" data-testid="ai-validation-error">
            <p className="text-sm text-error">
              {t("content.ai_check.failed", "AI check unavailable.")} {state.error}
            </p>
            <div className="form-actions">
              <Button type="button" variant="outline" onClick={close}>
                {t("common.close", "Close")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
