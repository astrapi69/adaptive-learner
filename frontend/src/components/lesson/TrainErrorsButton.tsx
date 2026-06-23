/**
 * TrainErrorsButton — the "Fehler trainieren" entry point (#1012).
 *
 * A gated, count-bearing link into the existing adaptive-lesson page, which
 * builds a synthetic lesson from the learner's failed cards. Two scopes:
 *   - set-wide   → ``/adaptive-lesson/:setId``        (every lesson's errors)
 *   - per-lesson → ``/adaptive-lesson/:setId?lesson=`` (one lesson's errors)
 *
 * Presentational + props-driven: the caller passes the in-scope active
 * error-card count (derived from the SRS data it already holds), so the button
 * does no storage read of its own. Renders **nothing** when ``errorCount <= 0``
 * — the issue's "button only when ≥1 error card" rule, matching the sibling
 * "Retry errors" / FocusAreasCard hide-when-empty behaviour.
 *
 * @example
 * <TrainErrorsButton setId={set.setId} errorCount={set.errorCount} />
 * <TrainErrorsButton setId={l.setId} lessonId={l.filename} errorCount={n} />
 */

import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../hooks/ui/useI18n";

export interface TrainErrorsButtonProps {
  setId: string;
  /** Active (non-mastered) error-card count in scope. Hidden when <= 0. */
  errorCount: number;
  /** Scope to one lesson's errors; omit for the whole set. */
  lessonId?: string;
  /** Extra classes appended to the base button styling. */
  className?: string;
  testId?: string;
}

export default function TrainErrorsButton({
  setId,
  errorCount,
  lessonId,
  className = "",
  testId,
}: TrainErrorsButtonProps) {
  const { t } = useI18n();
  if (errorCount <= 0) return null;

  const href = lessonId
    ? `/adaptive-lesson/${encodeURIComponent(setId)}?lesson=${encodeURIComponent(lessonId)}`
    : `/adaptive-lesson/${encodeURIComponent(setId)}`;

  return (
    <Link
      to={href}
      // #779 — data-slot so the global anchor-color rule skips this
      // button-styled link (else the label inherits var(--accent)).
      data-slot="button"
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-app bg-accent px-3 py-2 text-sm font-medium text-accent-fg ${className}`}
      data-testid={testId ?? (lessonId ? `lesson-train-errors-${lessonId}` : `set-train-errors-${setId}`)}
    >
      <Sparkles size={16} aria-hidden="true" />
      {t("learning_path.train_errors", "Train errors")} ({errorCount})
    </Link>
  );
}
