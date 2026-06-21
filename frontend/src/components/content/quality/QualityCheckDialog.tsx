/**
 * QualityCheckDialog — the EXP-032 deterministic content-quality check
 * (CQV-01..03) for a single cached set. Runs offline + instantly (no API
 * key): accent, article, and duplicate findings rendered through the shared
 * {@link ValidationReport}.
 *
 * The check runs through {@link useContentQualityCheck}
 * (``getStorage().contentLoader`` — both storage modes).
 */

import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";

import ValidationReport, {
  type ValidationReportItem,
  type ValidationReportIssue,
} from "../../../shared/feedback/ValidationReport";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  useContentQualityCheck,
  type QualityCardMeta,
} from "../../../hooks/content/useContentQualityCheck";
import type { QualityReport } from "../../../lib/content-quality";
import type { ContentSetEntry } from "../../../storage/types";

export interface QualityCheckDialogProps {
  /** The set under review, or null when the dialog is closed. */
  entry: ContentSetEntry | null;
  onClose: () => void;
}

type Translate = (key: string, fallback: string) => string;

/** Compose the per-card report items from the raw findings + i18n labels. */
function buildItems(
  report: QualityReport,
  meta: Map<string, QualityCardMeta>,
  t: Translate,
): ValidationReportItem[] {
  const byCard = new Map<string, ValidationReportItem>();
  const ensure = (cardId: string): ValidationReportItem => {
    let item = byCard.get(cardId);
    if (!item) {
      const m = meta.get(cardId);
      const label = m
        ? m.lessonTitle
          ? `${m.lessonTitle} — ${m.front}`
          : m.front
        : cardId;
      item = { cardId, label, issues: [] };
      byCard.set(cardId, item);
    }
    return item;
  };
  const push = (cardId: string, issue: ValidationReportIssue) =>
    ensure(cardId).issues.push(issue);

  for (const f of report.accents) {
    push(f.card_id, {
      field: f.field,
      problem: t("content.quality.accent.problem", "Missing accent: {word}").replace(
        "{word}",
        f.word,
      ),
      suggestion: f.expected,
    });
  }
  for (const f of report.articles) {
    push(f.card_id, {
      field: "front",
      problem: t("content.quality.article.problem", "Wrong article: {actual} {noun}")
        .replace("{actual}", f.actual)
        .replace("{noun}", f.noun),
      suggestion: `${f.expected_article} ${f.noun}`,
    });
  }
  for (const f of report.duplicates) {
    const other = meta.get(f.card_id_a)?.front ?? f.card_id_a;
    push(f.card_id_b, {
      field: "",
      problem: t("content.quality.duplicate.problem", "Duplicate of: {other}").replace(
        "{other}",
        other,
      ),
      suggestion: "",
    });
  }
  return [...byCard.values()];
}

export default function QualityCheckDialog({
  entry,
  onClose,
}: QualityCheckDialogProps) {
  const { t } = useI18n();
  const { state, run, reset } = useContentQualityCheck();

  useEffect(() => {
    if (entry) void run(entry);
    else reset();
    // run/reset are stable; entry drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  const items = useMemo(
    () => (state.report ? buildItems(state.report, state.meta, t) : []),
    [state.report, state.meta, t],
  );

  if (!entry) return null;

  const close = () => {
    reset();
    onClose();
  };

  return (
    <div className="modal-overlay" data-testid="quality-check-modal">
      <div
        className="modal-card max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quality-check-title"
      >
        <h2 id="quality-check-title" className="modal-title">
          {t("content.quality.title", "Quality check")}
        </h2>
        <p className="text-sm text-fg-muted">{entry.title}</p>

        {state.phase === "loading" && (
          <p
            className="mt-4 text-sm text-fg-secondary"
            data-testid="quality-check-loading"
          >
            {t("content.quality.loading", "Checking cards…")}
          </p>
        )}

        {state.phase === "done" && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-xs text-fg-muted">
              {t(
                "content.quality.offline_note",
                "Runs offline — accents, articles, and duplicate cards. No API key needed.",
              )}
            </p>
            <ValidationReport
              setName={entry.title}
              summaryText={t(
                "content.quality.report.summary",
                "Checked {cards} cards in {lessons} lessons",
              )
                .replace("{cards}", String(state.cardCount))
                .replace("{lessons}", String(state.lessonCount))}
              okText={t("content.quality.report.ok", "{count} cards OK").replace(
                "{count}",
                String(Math.max(0, state.cardCount - items.length)),
              )}
              issuesText={
                items.length > 0
                  ? t(
                      "content.quality.report.issues",
                      "{count} cards with issues",
                    ).replace("{count}", String(items.length))
                  : undefined
              }
              allOkText={t(
                "content.quality.report.all_ok",
                "No issues found — accents, articles, and duplicates all clean.",
              )}
              problemLabel={t("content.quality.report.problem", "Problem")}
              suggestionLabel={t(
                "content.quality.report.suggestion",
                "Suggestion",
              )}
              items={items}
              testId="quality-check-report"
            />
            <div className="form-actions">
              <Button
                type="button"
                onClick={close}
                data-testid="quality-check-close"
              >
                {t("common.close", "Close")}
              </Button>
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div
            className="mt-4 flex flex-col gap-3"
            data-testid="quality-check-error"
          >
            <p className="text-sm text-error">
              {t("content.quality.failed", "Quality check unavailable.")}{" "}
              {state.error}
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
