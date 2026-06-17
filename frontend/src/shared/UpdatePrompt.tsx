/**
 * UpdatePrompt — a slim, discreet "new version available" banner
 * (#613, #649, #653).
 *
 * Fully presentational and app-agnostic: all copy + the two callbacks are
 * caller-supplied, no i18n/storage imports. It is NOT a modal — it offers
 * exactly two actions (update / dismiss). Token-backed Tailwind, 44px
 * targets, ``role="status"`` so screen readers announce it without
 * stealing focus.
 *
 * Position (#653): the banner is anchored to the BOTTOM of the viewport,
 * full width, ``z-40`` (above app content, below the ``z-50`` modal layer).
 * A top anchor collided with the app navigation on desktop and with the
 * iOS-Safari address bar on mobile (pull-to-refresh hid it, making it
 * unreachable). The bottom edge pads with ``env(safe-area-inset-bottom)``
 * so the controls clear the iPhone home indicator while the surface still
 * fills to the screen edge.
 *
 * Colour contract (#649 + #653): a neutral elevated surface (``--bg-card``)
 * carries primary text (``--fg-primary``), and the update action is the
 * accent CTA (``--accent`` / ``--accent-fg``). All three pairings —
 * ``fg-primary`` on ``bg-surface``, ``accent-fg`` on ``accent``, and
 * ``fg-secondary`` on ``bg-surface`` for the dismiss X — are enforced
 * ≥ WCAG AA across all 12 themes by ``contrast.test.ts``, so the banner is
 * legible by construction in every theme. No theme-dependent pairing, no
 * hardcoded colours.
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

/** Discreet bottom-anchored app-update banner (presentational). */
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card text-fg-primary shadow-lg pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-center gap-3 px-3 py-2 text-sm">
        <RefreshCw size={16} aria-hidden="true" className="shrink-0 text-accent" />
        <span className="truncate">{message}</span>
        <button
          type="button"
          onClick={onUpdate}
          data-testid="update-prompt-apply"
          className="inline-flex min-h-[44px] items-center rounded-md bg-accent px-3 font-semibold text-accent-foreground hover:brightness-110"
        >
          {updateLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
          data-testid="update-prompt-dismiss"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-fg-secondary hover:bg-muted"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
