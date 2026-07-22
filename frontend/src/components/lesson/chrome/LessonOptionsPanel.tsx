/**
 * LessonOptionsPanel (#1625).
 *
 * A compact, collapsible disclosure that bundles the lesson's mode /
 * display SETTINGS (favorite, mode toggle, auto read-aloud) into one
 * group so they stop eating vertical space above the exercise on
 * mobile. Follows the app's existing disclosure pattern (see
 * ``BookRecommendations``): a shadcn ``Button`` with ``aria-expanded`` +
 * a chevron, revealing a token-styled body via the ``hidden`` attribute
 * (so it costs no layout space while collapsed and stays referenced by
 * ``aria-controls``).
 *
 * Default collapsed. State is local; the lesson player remounts the
 * panel per lesson (via a ``key``) so a new lesson starts collapsed
 * while a step change within the same lesson preserves the choice.
 *
 * Presentation only — the controls it wraps own their own behaviour.
 *
 * @example
 * <LessonOptionsPanel key={lessonId} summary={t("lesson.mode.practice")}>
 *   <LessonFavoriteToggle ... />
 *   <LessonModeToggle ... />
 * </LessonOptionsPanel>
 */

import { type ReactNode, useId, useState } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "../../../hooks/ui/useI18n";

export interface LessonOptionsPanelProps {
  /** Compact label shown alongside the trigger while collapsed
   *  (typically the current lesson-mode name). */
  summary: string;
  /** Extra utility classes on the outer section (e.g. flex-row sizing
   *  when the panel sits beside the progress bar). */
  className?: string;
  /** The bundled setting controls. */
  children: ReactNode;
}

/**
 * Render the collapsible lesson-options group.
 *
 * @param props - See {@link LessonOptionsPanelProps}.
 */
export default function LessonOptionsPanel({
  summary,
  className,
  children,
}: LessonOptionsPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();

  return (
    <section className={cn("px-2", className)} data-testid="lesson-options-panel">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5 px-2 font-medium"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((v) => !v)}
        data-testid="lesson-options-toggle"
      >
        {expanded ? (
          <ChevronDown aria-hidden="true" className="size-4" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-4" />
        )}
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {t("lesson.options.title", "Options")}
        {!expanded && summary && (
          <span className="font-normal text-fg-muted">· {summary}</span>
        )}
      </Button>
      <div
        id={bodyId}
        hidden={!expanded}
        className="mt-2 flex flex-col gap-2"
        data-testid="lesson-options-body"
      >
        {children}
      </div>
    </section>
  );
}
