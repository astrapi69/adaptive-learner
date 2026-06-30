/**
 * InfoHintButton (#1272) — the presentational ``i`` toggle button.
 *
 * Extracted from {@link InfoHint} so a surface that lays out the trigger and
 * the revealed text in *separate* containers (e.g. a button inline in a header
 * row, the text full-width below it) can reuse the exact button — same blink
 * animation, focus ring, 44px target and aria wiring — without duplicating it.
 * {@link InfoHint} composes this button with its own inline text panel.
 *
 * Controlled + app-agnostic: it owns no state. The caller drives ``expanded`` /
 * ``blink`` (typically from {@link useInfoHint}) and ``onClick``.
 *
 * @example
 * const { expanded, blink, toggle } = useInfoHint("content_my");
 * <InfoHintButton expanded={expanded} blink={blink} onClick={toggle}
 *   label={t("ui.info.show", "Show information")} controls="content-info-text"
 *   testId="content-info-button" />
 */

import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export interface InfoHintButtonProps {
  /** Whether the associated text is currently expanded (drives aria-expanded). */
  expanded: boolean;
  /** Whether the button should draw the gentle attention blink. */
  blink: boolean;
  /** Accessible name for the button (e.g. "Show information"). */
  label: string;
  /** id of the element the button controls (aria-controls). */
  controls: string;
  /** Toggle handler. */
  onClick: () => void;
  /** Test id for the button. */
  testId: string;
  /** Optional extra classes (e.g. ``self-center`` when inline in a flex row). */
  className?: string;
}

export default function InfoHintButton({
  expanded,
  blink,
  label,
  controls,
  onClick,
  testId,
  className,
}: InfoHintButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      title={label}
      data-testid={testId}
      data-blink={blink ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-fg-muted",
        "hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-accent focus-visible:ring-offset-2",
        blink && "motion-safe:animate-[info-hint-blink_1.4s_ease-in-out_3]",
        className,
      )}
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );
}
