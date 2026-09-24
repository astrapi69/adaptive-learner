/**
 * RunnerHeader (EXP-052 slices 1 and 3, refs #3169).
 *
 * The header of the runner shell in the variant the policy's ``exit``
 * selects:
 *
 * - ``{ backTo }`` (the four session runners): the session variant the
 *   pages render today, byte for byte: a back button to one fixed route
 *   under ``{prefix}-back-btn``, the full title as ``<h1>``, the subtitle
 *   under ``{prefix}-subtitle`` when the source carries one, then the
 *   optional header extension. The label reads the shared
 *   ``runner.back_to_dashboard`` (#3203): the same condition on every
 *   session runner, one catalog home.
 * - ``"back-button"`` (Error Replay, slice 3): the same session variant,
 *   labelled "Back to lesson" (``lesson.action.back_to_lesson``), leaving
 *   to the destination the source supplies (``RunnerSource.backTo``: the
 *   lesson the replay came from, or a flash round's origin). Without one
 *   no back button renders: a guessed history step could leave the app.
 * - ``"set-link"`` (the lesson, slice 4): the lesson variant, which slice 4
 *   makes byte-identical to ``chrome/LessonHeader.tsx`` (position row,
 *   set link, compact title, credit). Until then only the title renders.
 *
 * The title carries ``wrap-anywhere`` (#2761, moved into the shell in
 * slice 3): a long unbreakable word ("Organisationspsychologie") breaks
 * instead of widening the page, which iOS WebKit answers by clipping the
 * sticky footer's Next button (#1834 class).
 *
 * @example
 * <RunnerHeader policy={REVIEW_POLICY} source={source} headerExtra={headerExtra} />
 */

import { BookOpen } from "lucide-react";
import { useNavigate, type NavigateFunction } from "react-router";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { RunnerHeaderExtraRenderer, RunnerPolicy, RunnerSource } from "./types";

export interface RunnerHeaderProps {
  policy: Pick<RunnerPolicy, "testIdPrefix" | "exit">;
  source: RunnerSource;
  headerExtra?: RunnerHeaderExtraRenderer;
}

type Translate = (key: string, fallback?: string) => string;

interface BackAction {
  label: string;
  onBack: () => void;
}

/** The back button of the policy's exit, or ``null`` when there is none to render. */
function backActionOf(
  exit: RunnerPolicy["exit"],
  backTo: string | undefined,
  navigate: NavigateFunction,
  t: Translate,
): BackAction | null {
  // TODO(#3169) slice 4: "set-link" becomes the LessonHeader markup.
  if (exit === "set-link") return null;
  if (exit === "back-button") {
    if (!backTo) return null;
    return {
      label: t("lesson.action.back_to_lesson", "Back to lesson"),
      onBack: () => navigate(backTo),
    };
  }
  return {
    label: t("runner.back_to_dashboard", "Back to Dashboard"),
    onBack: () => navigate(exit.backTo),
  };
}

/** Session header (back button, title, subtitle) or the slice-4 lesson placeholder. */
export default function RunnerHeader({ policy, source, headerExtra }: RunnerHeaderProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const testId = (suffix: string) => `${policy.testIdPrefix}-${suffix}`;
  const back = backActionOf(policy.exit, source.backTo, navigate, t);

  return (
    <header className="lesson-header">
      {back && (
        <button
          type="button"
          className="lesson-back-btn"
          onClick={back.onBack}
          data-testid={testId("back-btn")}
          aria-label={back.label}
        >
          <BookOpen size={16} aria-hidden="true" />
          {back.label}
        </button>
      )}
      <h1 className="wrap-anywhere">{source.title}</h1>
      {source.subtitle && (
        <p className="lesson-description" data-testid={testId("subtitle")}>
          {source.subtitle}
        </p>
      )}
      {headerExtra?.(source)}
    </header>
  );
}
