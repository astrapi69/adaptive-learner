/**
 * AiFixPanel (AIV-07, #3060): the "Apply suggestions" step inside the AI
 * check dialog. Switches on the ``useAiFix`` phase: loading the lessons,
 * the review table with its back/confirm footer, and the applied/undone
 * result with undo, re-check and close. Presentational; the dialog owns
 * the hook and passes it in.
 *
 * @example
 * <AiFixPanel fix={fix} onRecheck={recheck} onClose={close} t={t} />
 */

import { Button } from "@/components/ui/button";

import type { UseAiFix } from "../../../hooks/content/useAiFix";
import AiFixReview from "./AiFixReview";

type Translate = (key: string, fallback?: string) => string;

export interface AiFixPanelProps {
  fix: UseAiFix;
  onRecheck: () => void;
  onClose: () => void;
  t: Translate;
}

const FOOTER =
  "mt-4 flex justify-end gap-3 max-[769px]:flex-col max-[769px]:items-stretch max-[769px]:gap-2";

function selectedCounts(fix: UseAiFix): { fields: number; cards: number } {
  const chosen = fix.state.plan?.candidates.filter((c) => fix.state.selected.has(c.key)) ?? [];
  return { fields: chosen.length, cards: new Set(chosen.map((c) => c.cardId)).size };
}

function ReviewStep({ fix, t }: { fix: UseAiFix; t: Translate }) {
  const plan = fix.state.plan;
  if (!plan) return null;
  const busy = fix.state.phase === "busy";
  const { fields, cards } = selectedCounts(fix);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <h3 className="m-0 text-base font-semibold text-fg-primary">
        {t("content.ai_check.fix.title", "Apply suggestions")}
      </h3>
      <AiFixReview
        plan={plan}
        selected={fix.state.selected}
        onToggle={fix.toggle}
        labels={{
          intro: t(
            "content.ai_check.fix.intro",
            "Check every row: only ticked rows are written. Leave out suggestions that explain instead of giving a value.",
          ),
          lesson: t("content.ai_check.export.lesson", "Lesson"),
          card: t("content.ai_check.export.card", "Card"),
          field: t("content.ai_check.export.field", "Field"),
          current: t("content.ai_check.fix.current", "Current"),
          suggested: t("content.ai_check.report.suggestion", "Suggestion"),
          manualCount:
            plan.manual.length > 0
              ? t(
                  "content.ai_check.fix.manual_count",
                  "{count} findings carry no value to apply and stay manual.",
                ).replace("{count}", String(plan.manual.length))
              : null,
          noneApplicable: t(
            "content.ai_check.fix.none_applicable",
            "No applicable suggestions in this report.",
          ),
        }}
      />
      <div className={FOOTER}>
        <Button
          type="button"
          variant="outline"
          onClick={fix.back}
          disabled={busy}
          data-testid="ai-validation-fix-back"
        >
          {t("common.back", "Back")}
        </Button>
        <Button
          type="button"
          onClick={() => void fix.confirm()}
          disabled={busy || fields === 0}
          data-testid="ai-validation-fix-confirm"
        >
          {t("content.ai_check.fix.confirm", "Apply {fields} fields in {cards} cards")
            .replace("{fields}", String(fields))
            .replace("{cards}", String(cards))}
        </Button>
      </div>
    </div>
  );
}

function ResultStep({ fix, onRecheck, onClose, t }: AiFixPanelProps) {
  const applied = fix.state.phase === "applied";
  const text = applied
    ? t(
        "content.ai_check.fix.applied",
        "{fields} fields applied. The report is out of date, re-check the set.",
      ).replace("{fields}", String(fix.state.appliedFields))
    : t("content.ai_check.fix.undone", "Apply undone.");
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p data-testid="ai-validation-fix-result" className="m-0 text-sm text-fg-primary">
        {text}
      </p>
      <div className={FOOTER}>
        {applied && fix.state.canUndo ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void fix.undo()}
            data-testid="ai-validation-fix-undo"
          >
            {t("content.ai_check.fix.undo", "Undo the last apply")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onRecheck}
          data-testid="ai-validation-recheck"
        >
          {t("content.ai_check.recheck", "Re-check")}
        </Button>
        <Button type="button" onClick={onClose} data-testid="ai-validation-close">
          {t("common.close", "Close")}
        </Button>
      </div>
    </div>
  );
}

export default function AiFixPanel(props: AiFixPanelProps) {
  const { fix, t } = props;
  switch (fix.state.phase) {
    case "loading":
      return (
        <p data-testid="ai-validation-fix-loading" className="mt-4 text-sm text-fg-muted">
          {t("content.ai_check.loading", "Preparing cards...")}
        </p>
      );
    case "review":
    case "busy":
      return <ReviewStep fix={fix} t={t} />;
    case "applied":
    case "undone":
      return <ResultStep {...props} />;
    default:
      return null;
  }
}
