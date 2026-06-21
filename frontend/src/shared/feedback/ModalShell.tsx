/**
 * ModalShell — a reusable, app-agnostic modal frame for RICH dialogs (unlike
 * {@link ConfirmDialog}, which is yes/no only). It provides the three things
 * every modal needs but that the raw ``.modal-overlay`` markup kept omitting
 * (#937): a **scrollable body** (so a long result list never pushes the actions
 * off-screen), and **three ways to dismiss** — an always-visible X, Escape, and
 * a backdrop click.
 *
 * Props-driven + app-agnostic (no i18n / storage / toast imports), token-backed
 * Tailwind only, so a contributor re-themes it by editing the design tokens.
 * The caller supplies the title + body and owns the open/close state.
 *
 * Accessibility: ``role="dialog"`` + ``aria-modal``, Escape + backdrop close,
 * focus restored to the opener on close. The card stops click propagation so a
 * click inside never dismisses.
 *
 * @example
 * <ModalShell open={open} title="AI content check" onClose={() => setOpen(false)}>
 *   <ReportList … />
 *   <div className="form-actions">…</div>
 * </ModalShell>
 */

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalShellProps {
  /** Whether the modal is mounted/visible. */
  open: boolean;
  /** Heading shown in the sticky header. */
  title: ReactNode;
  /** Dialog body — scrolls independently when it overflows. */
  children: ReactNode;
  /** Close handler (X button, Escape, backdrop click all call it). */
  onClose: () => void;
  /** Width class for the card (default ``max-w-2xl``). */
  widthClassName?: string;
  /** Accessible label for the X button (default ``"Close"``). */
  closeLabel?: string;
  /** Root test id; the card/body/X derive from it. */
  testId?: string;
}

export default function ModalShell({
  open,
  title,
  children,
  onClose,
  widthClassName = "max-w-2xl",
  closeLabel = "Close",
  testId = "modal",
}: ModalShellProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes; focus is restored to the opener on unmount.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--bg-overlay)] p-4"
      onClick={onClose}
      data-testid={testId}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        className={`flex max-h-[85vh] w-full ${widthClassName} flex-col rounded-lg border border-border bg-bg-surface shadow-lg`}
        onClick={(event) => event.stopPropagation()}
        data-testid={`${testId}-card`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-5 pb-3">
          <h2
            id={`${testId}-title`}
            data-testid={`${testId}-title`}
            className="text-lg font-semibold text-fg-primary"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-muted"
            data-testid={`${testId}-x`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto p-5 pt-3"
          data-testid={`${testId}-body`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
