/**
 * UpdatePrompt — a slim, discreet "new version available" banner (#613, #649,
 * #653).
 *
 * Fully presentational and app-agnostic: all copy + the two callbacks are
 * caller-supplied, no i18n/storage imports. It is NOT a modal — it never
 * blocks interaction, and offers exactly two actions (update / dismiss).
 * Token-backed Tailwind, 44px targets, ``role="status"`` so screen readers
 * announce it without stealing focus.
 *
 * Position contract (#653): the bar is anchored to the BOTTOM of the
 * viewport, not the top. A top-anchored banner lands under the iPhone Safari
 * address bar and is hidden by pull-to-refresh — the update action then
 * cannot be reached on mobile. Bottom-anchored with
 * ``padding-bottom: env(safe-area-inset-bottom)`` clears the iOS home
 * indicator and stays tappable on every browser. ``z-[9999]`` keeps it above
 * app chrome.
 *
 * Colour contract (#653): the bar itself is the readable surface pair —
 * ``--bg-surface`` background + ``--fg-primary`` text + a top ``--border``,
 * the SAME pairing every card uses, pinned ≥ WCAG AA across all 12 themes by
 * ``contrast.test.ts`` (fg-primary on bg-surface). The update action is the
 * accent button (``--accent`` surface, ``--accent-fg`` text — also AA-pinned),
 * so it stands out as the primary CTA. The dismiss X uses ``--fg-secondary``
 * (AA-pinned on surface). Every colour is a theme token guaranteed to be
 * defined (``themes.test.ts``) AND contrast-checked (``contrast.test.ts``) —
 * a stronger guarantee than a hardcoded literal fallback, and compliant with
 * the no-hardcoded-colors guard. The prior accent-on-accent fill (#649)
 * regressed to invisible text on the live site; the surface/text pair is the
 * robust fix.
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
  /**
   * Optional secondary line under the message (#1357). Used for the iOS
   * standalone clear-text fallback ("close the app and reopen it") when
   * skip-waiting + reload does not reliably activate a new worker on WKWebView.
   */
  hint?: string;
  testId?: string;
}

/** Discreet bottom-anchored app-update banner (presentational). */
export default function UpdatePrompt({
  message,
  updateLabel,
  dismissLabel,
  onUpdate,
  onDismiss,
  hint,
  testId,
}: UpdatePromptProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId ?? "update-prompt"}
      className="fixed inset-x-0 bottom-0 z-[9999] flex items-center justify-between gap-3 border-t border-border bg-bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-fg-primary shadow-md"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <RefreshCw
            size={16}
            aria-hidden="true"
            className="shrink-0 text-fg-secondary"
          />
          <span className="truncate text-fg-primary">{message}</span>
        </div>
        {hint ? (
          <span
            data-testid="update-prompt-hint"
            className="pl-6 text-xs text-fg-secondary"
          >
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onUpdate}
          data-testid="update-prompt-apply"
          className="inline-flex min-h-[44px] items-center rounded-app bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          {updateLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
          data-testid="update-prompt-dismiss"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-app text-fg-secondary hover:bg-bg-elevated"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
