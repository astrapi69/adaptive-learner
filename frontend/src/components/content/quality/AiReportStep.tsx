/**
 * AiReportStep (extracted from AiValidationDialog for #3060): the final
 * report of the set-wide AI check with its footer. Since AIV-07 the footer
 * also carries "Apply suggestions" (own sets only, #335 reason otherwise)
 * and "Undo the last apply" when a snapshot exists. Presentational; the
 * dialog owns the hooks and hands in the handlers.
 */

import { Button } from "@/components/ui/button";

import type { AiCheckState } from "../../../hooks/content/useAiCardValidation";
import ValidationReport, {
  type ValidationReportItem,
} from "../../../shared/feedback/ValidationReport";
import type { ContentSetEntry } from "../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

export interface AiReportStepProps {
  entry: ContentSetEntry;
  state: AiCheckState;
  reportItems: ValidationReportItem[];
  checkedWith: string;
  formatCheckedAt: (iso: string | null) => string;
  ownSet: boolean;
  canUndo: boolean;
  onOpenFix: () => void;
  onUndo: () => void;
  onExport: () => void;
  onRecheck: () => void;
  onClose: () => void;
  t: Translate;
}

export default function AiReportStep({
  entry,
  state,
  reportItems,
  checkedWith,
  formatCheckedAt,
  ownSet,
  canUndo,
  onOpenFix,
  onUndo,
  onExport,
  onRecheck,
  onClose,
  t,
}: AiReportStepProps) {
  return (
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
          "All cards passed - no issues found.",
        )}
        problemLabel={t("content.ai_check.report.problem", "Problem")}
        suggestionLabel={t("content.ai_check.report.suggestion", "Suggestion")}
        items={reportItems}
        testId="ai-validation-report"
      />
      {checkedWith && (
        <p
          className="text-xs text-fg-muted"
          data-testid="ai-validation-checked-with"
        >
          {checkedWith}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-3 max-[769px]:flex-col max-[769px]:items-stretch max-[769px]:gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onOpenFix}
          disabled={!ownSet || reportItems.length === 0}
          title={
            ownSet
              ? undefined
              : t("content.ai_check.fix.own_only", "Only for your own lessons.")
          }
          data-testid="ai-validation-fix-open"
        >
          {t("content.ai_check.fix.button", "Apply suggestions")}
        </Button>
        {canUndo && (
          <Button
            type="button"
            variant="outline"
            onClick={onUndo}
            data-testid="ai-validation-fix-undo"
          >
            {t("content.ai_check.fix.undo", "Undo the last apply")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onExport}
          data-testid="ai-validation-export-md"
        >
          {t("content.ai_check.export.button", "Export report as Markdown")}
        </Button>
        {state.cached && (
          <Button
            type="button"
            variant="outline"
            onClick={onRecheck}
            data-testid="ai-validation-recheck"
          >
            {t("content.ai_check.recheck", "Re-check")}
          </Button>
        )}
        <Button type="button" onClick={onClose} data-testid="ai-validation-close">
          {t("common.close", "Close")}
        </Button>
      </div>
    </div>
  );
}
