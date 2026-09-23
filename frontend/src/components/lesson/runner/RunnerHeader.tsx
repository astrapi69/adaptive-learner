/**
 * RunnerHeader (EXP-052 slice 1, refs #3169).
 *
 * The header of the runner shell in the variant the policy's ``exit``
 * selects:
 *
 * - ``{ backTo }`` (the four session runners): the session variant the
 *   pages render today, byte for byte: a back button to one fixed route
 *   under ``{prefix}-back-btn``, the full title as ``<h1>``, the subtitle
 *   under ``{prefix}-subtitle`` when the source carries one, then the
 *   optional header extension.
 * - ``"back-button"`` (Error Replay, slice 3): the same session variant
 *   with a run-time destination; until slice 3 supplies it the button
 *   steps back in history.
 * - ``"set-link"`` (the lesson, slice 4): the lesson variant, which slice 4
 *   makes byte-identical to ``chrome/LessonHeader.tsx`` (position row,
 *   set link, compact title, credit). Until then only the title renders.
 *
 * The back label reads the shared ``runner.back_to_dashboard`` (#3203):
 * the same condition on every session runner, one catalog home.
 *
 * @example
 * <RunnerHeader policy={REVIEW_POLICY} source={source} headerExtra={headerExtra} />
 */

import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { RunnerHeaderExtraRenderer, RunnerPolicy, RunnerSource } from "./types";

export interface RunnerHeaderProps {
  policy: Pick<RunnerPolicy, "testIdPrefix" | "exit">;
  source: RunnerSource;
  headerExtra?: RunnerHeaderExtraRenderer;
}

/** Session header (back button, title, subtitle) or the slice-4 lesson placeholder. */
export default function RunnerHeader({ policy, source, headerExtra }: RunnerHeaderProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const testId = (suffix: string) => `${policy.testIdPrefix}-${suffix}`;
  const backLabel = t("runner.back_to_dashboard", "Back to Dashboard");

  // TODO(#3169) slice 3: Error Replay returns to the lesson it was opened
  // from (a parameterised route the page supplies at run time) with its
  // own label; the history step is the placeholder until then.
  // TODO(#3169) slice 4: "set-link" becomes the LessonHeader markup.
  const { exit } = policy;
  const onBack =
    exit === "set-link"
      ? null
      : exit === "back-button"
        ? () => navigate(-1)
        : () => navigate(exit.backTo);

  return (
    <header className="lesson-header">
      {onBack && (
        <button
          type="button"
          className="lesson-back-btn"
          onClick={onBack}
          data-testid={testId("back-btn")}
          aria-label={backLabel}
        >
          <BookOpen size={16} aria-hidden="true" />
          {backLabel}
        </button>
      )}
      <h1>{source.title}</h1>
      {source.subtitle && (
        <p className="lesson-description" data-testid={testId("subtitle")}>
          {source.subtitle}
        </p>
      )}
      {headerExtra?.(source)}
    </header>
  );
}
