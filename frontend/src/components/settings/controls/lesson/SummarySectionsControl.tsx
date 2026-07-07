/**
 * SummarySectionsControl — Settings → Learning sub-area "Lesson summary"
 * (#1426, generalises #1411). A numbered reorder list (Up/Down per row, same
 * pattern as the content-tabs / content-repo precedence reorder) where each
 * row ALSO carries the section's visibility checkbox — so sichtbarkeit and
 * position are set in one place. All sections default ON, in today's order.
 *
 * A disabled section keeps its row (greyed, checkbox unchecked) and its
 * Up/Down buttons stay usable, so it holds its list position and reappears
 * there when re-enabled. The essential completion navigation (mark-as-complete
 * + the next / repeat / exit actions) is not listed — it is always shown so the
 * panel can never become a dead end.
 *
 * Persists the whole ordered config via ``lib/learning/summarySectionsPref``
 * (one localStorage object, both storage modes). Token-backed Tailwind, 44px
 * touch targets, a11y (ordered list, aria-labelled arrows + checkboxes).
 */

import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { useSummarySections } from "../../../../hooks/settings/useSummarySections";
import {
  moveSummarySection,
  setSummarySectionEnabled,
  writeSummarySections,
  type SummarySectionKey,
} from "../../../../lib/learning/summarySectionsPref";

/** i18n key + English fallback per section. The correction row keeps the
 *  #1376 label keys so existing translations are reused unchanged. */
const SECTION_LABELS: Record<
  SummarySectionKey,
  { key: string; fallback: string }
> = {
  favorite: {
    key: "settings.summary_section_favorite",
    fallback: "Favorites hint",
  },
  result: {
    key: "settings.summary_section_result",
    fallback: "Result and statistics",
  },
  xp: { key: "settings.summary_section_xp", fallback: "XP reward" },
  share: { key: "settings.summary_section_share", fallback: "Share result" },
  answers: {
    key: "settings.summary_section_answers",
    fallback: "Answers overview",
  },
  export: {
    key: "settings.summary_section_export",
    fallback: "Result export",
  },
  next_steps: {
    key: "settings.summary_section_next_steps",
    fallback: "Next-step suggestions",
  },
  correction: {
    key: "settings.correction_round_enabled",
    fallback: "Show the correction round after lessons",
  },
};

export default function SummarySectionsControl() {
  const { t } = useI18n();
  const config = useSummarySections();

  const move = (id: SummarySectionKey, direction: -1 | 1) => {
    writeSummarySections(moveSummarySection(config, id, direction));
  };

  const toggle = (id: SummarySectionKey, enabled: boolean) => {
    setSummarySectionEnabled(id, enabled);
  };

  return (
    <section
      className="settings-section"
      data-testid="settings-section-summary-sections"
    >
      <h2 className="settings-section-title">
        {t("settings.section_lesson_summary", "Lesson summary")}
      </h2>
      <p className="form-hint mb-2">
        {t(
          "settings.summary_sections_desc",
          "Choose which sections the summary at the end of a lesson shows and in which order. The actions for continuing are always visible.",
        )}
      </p>
      <ol
        className="flex flex-col gap-2"
        data-testid="summary-sections-order-list"
      >
        {config.map(({ id, enabled }, index) => {
          const label = SECTION_LABELS[id];
          return (
            <li
              key={id}
              data-testid={`summary-sections-order-item-${id}`}
              className={`flex items-center justify-between gap-2 rounded-app border border-border bg-bg-elevated px-3 py-2${
                enabled ? "" : " opacity-60"
              }`}
            >
              <label className="flex min-h-11 flex-1 items-center gap-2 text-sm font-medium text-fg-primary">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  data-testid={`settings-summary-section-${id}`}
                  checked={enabled}
                  onChange={(e) => toggle(id, e.target.checked)}
                />
                <span className="mr-1 text-fg-muted">{index + 1}.</span>
                {t(label.key, label.fallback)}
              </label>
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => move(id, -1)}
                  disabled={index === 0}
                  aria-label={t("content_repo.action.move_up", "Move up")}
                  title={t("content_repo.action.move_up", "Move up")}
                  data-testid={`summary-sections-up-${id}`}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => move(id, 1)}
                  disabled={index === config.length - 1}
                  aria-label={t("content_repo.action.move_down", "Move down")}
                  title={t("content_repo.action.move_down", "Move down")}
                  data-testid={`summary-sections-down-${id}`}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
