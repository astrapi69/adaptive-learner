/**
 * InfoHint (#1251) — an info button that reveals an explanatory text inline.
 *
 * Replaces a permanent paragraph of onboarding prose with a compact ``i``
 * button: click toggles the text open/closed right below the button (inline,
 * not a popover). For the first few visits the button blinks gently to draw a
 * newcomer's eye; the blink bows out once the user opens it OR after a few
 * visits without a click (see {@link useInfoHint}). Per-hint state persists in
 * localStorage keyed by ``storageId`` (one id per tab).
 *
 * App-agnostic: the text + aria-label come in via props, so any surface can
 * reuse it. The blink is gated behind Tailwind's ``motion-safe:`` variant, so
 * ``prefers-reduced-motion`` users get a still (but fully functional) button.
 *
 * @example
 * <InfoHint storageId="content_my" text={t("content.intro", "…")} label={t("ui.info.show", "Show information")} />
 */

import { cn } from "@/lib/utils";
import InfoHintButton from "./InfoHintButton";
import { useInfoHint } from "./useInfoHint";

export interface InfoHintProps {
  /** Per-hint persistence id (one per tab, e.g. ``content_my``). */
  storageId: string;
  /** The explanatory text revealed when the hint is opened. */
  text: string;
  /** Accessible name for the button (e.g. "Show information"). */
  label: string;
  /** Optional wrapper class. */
  className?: string;
  /** Base test id; the button is ``${testId}-button`` and the text
   *  ``${testId}-text``. */
  testId?: string;
}

export default function InfoHint({
  storageId,
  text,
  label,
  className,
  testId = "info-hint",
}: InfoHintProps) {
  const { expanded, blink, toggle } = useInfoHint(storageId);
  const textId = `${testId}-text`;

  return (
    <div className={cn("mb-4", className)} data-testid={testId}>
      <InfoHintButton
        expanded={expanded}
        blink={blink}
        label={label}
        controls={textId}
        onClick={toggle}
        testId={`${testId}-button`}
      />
      {expanded && (
        <p
          id={textId}
          data-testid={textId}
          className="mt-1 text-sm text-muted-foreground"
        >
          {text}
        </p>
      )}
    </div>
  );
}
