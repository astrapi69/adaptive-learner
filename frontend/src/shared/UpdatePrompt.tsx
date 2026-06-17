/**
 * UpdatePrompt — a slim, discreet "new version available" banner (#613, #649).
 *
 * Fully presentational and app-agnostic: all copy + the two callbacks are
 * caller-supplied, no i18n/storage imports. It is NOT a modal — it sits at
 * the top of the viewport, never blocks interaction, and offers exactly
 * two actions (update / dismiss). Token-backed Tailwind, 44px targets,
 * ``role="status"`` so screen readers announce it without stealing focus.
 *
 * Colour contract (#649): the bar is painted with ``--accent`` /
 * ``--accent-fg``, the one token pair whose contrast is enforced ≥ WCAG AA
 * across all 12 themes (``contrast.test.ts``). So the message + icon are
 * legible by construction in every theme; the update action is an inverse
 * chip (``accent-fg`` surface, ``accent`` text — the same pair flipped) so it
 * reads clearly as a button on the accent bar. No theme-dependent pairing,
 * no hardcoded colours.
 *
 * @example
 * <UpdatePrompt
 *   message="A new version is available."
 *   updateLabel="Update"
 *   dismissLabel="Later"
 *   onUpdate={applyUpdate}
 *   onDismiss={dismiss}
 * />
 */

import { RefreshCw, X } from "lucide-react";

export interface UpdatePromptProps {
  /** The headline message, e.g. "A new version is available." */
  message: string;
  /** Label for the apply-update button. */
  updateLabel: string;
  /** Label / accessible name for the dismiss button. */
  dismissLabel: string;
  onUpdate: () => void;
  onDismiss: () => void;
  testId?: string;
}

/** Discreet top-anchored app-update banner (presentational). */
export default function UpdatePrompt({
  message,
  updateLabel,
  dismissLabel,
  onUpdate,
  onDismiss,
  testId,
}: UpdatePromptProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId ?? "update-prompt"}
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-accent px-3 py-2 text-sm text-accent-foreground shadow-md"
    >
      <RefreshCw
        size={16}
        aria-hidden="true"
        className="shrink-0 text-accent-foreground"
      />
      <span className="truncate">{message}</span>
      <button
        type="button"
        onClick={onUpdate}
        data-testid="update-prompt-apply"
        className="inline-flex min-h-[44px] items-center rounded-md bg-accent-foreground px-3 font-semibold text-accent hover:opacity-90"
      >
        {updateLabel}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
        data-testid="update-prompt-dismiss"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-accent-foreground hover:bg-accent-foreground/15"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
