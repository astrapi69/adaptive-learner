/**
 * SummarySectionsControl — Settings → Learning sub-area "Lesson summary"
 * (#1411). One toggle per configurable section of the lesson-completion
 * summary panel; all default ON. The essential completion navigation
 * (mark-as-complete + the next / repeat / exit actions) is not listed —
 * it is always shown so the panel can never become a dead end.
 *
 * Persists the flags together as ONE settings object via
 * ``lib/learning/summarySectionsPref`` (localStorage, both storage modes).
 * Supersedes the #1376 ``CorrectionRoundControl``: the correction-round
 * toggle now lives here, with its stored choice migrated.
 */

import { useState } from "react";

import { useI18n } from "../../../../hooks/ui/useI18n";
import {
  SUMMARY_SECTION_KEYS,
  readSummarySections,
  setSummarySectionEnabled,
  type SummarySectionKey,
} from "../../../../lib/learning/summarySectionsPref";

/** i18n key + English fallback per section toggle. The correction row keeps
 *  the #1376 label keys so existing translations are reused unchanged. */
const SECTION_LABELS: Record<
  SummarySectionKey,
  { key: string; fallback: string; hintKey?: string; hintFallback?: string }
> = {
  result: {
    key: "settings.summary_section_result",
    fallback: "Result and statistics",
  },
  xp: { key: "settings.summary_section_xp", fallback: "XP reward" },
  favorite: {
    key: "settings.summary_section_favorite",
    fallback: "Favorites hint",
  },
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
    hintKey: "settings.correction_round_enabled_desc",
    hintFallback:
      'At the end of a lesson, offer to fix your mistakes right away. When off, they stay available in the review / "Practice errors" mode.',
  },
};

export default function SummarySectionsControl() {
  const { t } = useI18n();
  const [sections, setSections] = useState(() => readSummarySections());

  const handleToggle = (key: SummarySectionKey, enabled: boolean) => {
    setSections((prev) => ({ ...prev, [key]: enabled }));
    setSummarySectionEnabled(key, enabled);
  };

  return (
    <section
      className="settings-section"
      data-testid="settings-section-summary-sections"
    >
      <h2 className="settings-section-title">
        {t("settings.section_lesson_summary", "Lesson summary")}
      </h2>
      <p className="form-hint">
        {t(
          "settings.summary_sections_desc",
          "Choose which sections the summary at the end of a lesson shows. The actions for continuing are always visible.",
        )}
      </p>
      {SUMMARY_SECTION_KEYS.map((key) => {
        const label = SECTION_LABELS[key];
        return (
          <label key={key} className="form-row form-row-toggle">
            <span className="form-label-stack">
              <span className="form-label">{t(label.key, label.fallback)}</span>
              {label.hintKey && (
                <span className="form-hint">
                  {t(label.hintKey, label.hintFallback)}
                </span>
              )}
            </span>
            <input
              type="checkbox"
              data-testid={`settings-summary-section-${key}`}
              checked={sections[key]}
              onChange={(e) => handleToggle(key, e.target.checked)}
            />
          </label>
        );
      })}
    </section>
  );
}
