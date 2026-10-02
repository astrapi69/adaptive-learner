/**
 * AdaptiveTransparencyDisplay (F-115; a header extension since EXP-052
 * slice 3, refs #3169).
 *
 * What the adaptive lesson targets and why, under the title: the focus
 * tags from the error classifier ("This lesson focuses on: Article gender,
 * Word order") and the number of active errors driving the generation. No
 * black box: the learner always knows what the lesson targets. Hung into
 * ``LessonRunner`` through its ``headerExtra`` render prop (EXP-052
 * Befund 3, no policy column); moved out of ``pages/lesson/AdaptiveLesson.tsx``
 * with its testids (``adaptive-transparency``, ``-focus``, ``-errors``).
 *
 * @example
 * headerExtra={() =>
 *   source.transparency && <AdaptiveTransparencyDisplay transparency={source.transparency} />}
 */

import { Sparkles } from "lucide-react";

import type { AdaptiveTransparency } from "../../../../hooks/lesson/modes/useAdaptiveLesson";
import { useI18n } from "../../../../hooks/ui/useI18n";
import type { ErrorTag } from "../../../../lib/adaptive/error-classifier";

export interface AdaptiveTransparencyDisplayProps {
  transparency: AdaptiveTransparency;
}

/** Catalog key and en fallback per focus tag (shared with the dashboard's focus areas). */
const TAG_I18N_KEYS: Record<ErrorTag, [string, string]> = {
  article_gender: ["dashboard.focus_areas.tag.article_gender", "Article gender"],
  spelling_accent: ["dashboard.focus_areas.tag.spelling_accent", "Spelling & accents"],
  verb_conjugation: ["dashboard.focus_areas.tag.verb_conjugation", "Verb conjugation"],
  word_order: ["dashboard.focus_areas.tag.word_order", "Word order"],
};

/** The focus line and the active-error count of an adaptive lesson. */
export default function AdaptiveTransparencyDisplay({
  transparency,
}: AdaptiveTransparencyDisplayProps) {
  const { t } = useI18n();
  const tagText =
    transparency.tags.length > 0
      ? transparency.tags.map((tag) => t(...TAG_I18N_KEYS[tag])).join(", ")
      : t("adaptive.transparency.tag_none", "your weakest elements");
  const errorsLine = t("adaptive.transparency.errors_line", "Based on {n} active error(s)").replace(
    "{n}",
    String(transparency.total_errors),
  );
  return (
    <div className="lesson-description adaptive-transparency" data-testid="adaptive-transparency">
      <p data-testid="adaptive-transparency-focus">
        <Sparkles size={14} aria-hidden="true" />
        {t("adaptive.transparency.focus_prefix", "This lesson focuses on:")}{" "}
        <strong>{tagText}</strong>
      </p>
      <p className="muted" data-testid="adaptive-transparency-errors">
        {errorsLine}
      </p>
    </div>
  );
}
