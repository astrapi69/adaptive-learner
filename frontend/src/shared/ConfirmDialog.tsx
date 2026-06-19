/**
 * ConfirmDialog — a reusable, app-agnostic confirmation modal that
 * replaces the native ``window.confirm`` (#783).
 *
 * Props-driven and self-contained: title / message / labels arrive as
 * props (labels default to English so the component carries no i18n
 * dependency), and the outcome is reported through ``onConfirm`` /
 * ``onCancel``. No storage / toast / i18n imports — token-backed
 * Tailwind only, so a contributor re-themes it by editing the design
 * tokens, never this file.
 *
 * Accessibility: ``role="alertdialog"`` + ``aria-modal``, a focus trap
 * that keeps Tab within the dialog, auto-focus on the Cancel button
 * (the safe default for a destructive action), Escape and backdrop
 * click both cancel, and focus is restored to the previously-focused
 * element on close.
 *
 * @example
 * <ConfirmDialog
 *   open={open}
 *   title="Remove API key"
 *   message="Really remove this API key?"
 *   variant="danger"
 *   confirmLabel="Remove"
 *   onConfirm={() => { remove(); setOpen(false); }}
 *   onCancel={() => setOpen(false)}
 * />
 */

import { useEffect, useRef } from "react";

export type ConfirmVariant = "danger" | "default";

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    /** Confirm-button label (default "OK"). */
    confirmLabel?: string;
    /** Cancel-button label (default "Cancel"). */
    cancelLabel?: string;
    /** ``danger`` renders a red confirm button for destructive actions. */
    variant?: ConfirmVariant;
    onConfirm: () => void;
    onCancel: () => void;
    testId?: string;
}

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "OK",
    cancelLabel = "Cancel",
    variant = "default",
    onConfirm,
    onCancel,
    testId = "confirm-dialog",
}: ConfirmDialogProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    // Keep a live ref to onCancel so the key/Escape effect can stay
    // keyed on ``open`` alone — it must not re-run (and re-trap focus)
    // on every parent render.
    const onCancelRef = useRef(onCancel);
    onCancelRef.current = onCancel;

    // Auto-focus Cancel on open + restore focus to the opener on close.
    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        cancelRef.current?.focus();
        return () => opener?.focus?.();
    }, [open]);

    // Escape cancels; Tab is trapped within the dialog's focusables.
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCancelRef.current();
                return;
            }
            if (event.key !== "Tab") return;
            const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusables || focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    if (!open) return null;

    const confirmClass =
        variant === "danger"
            ? "bg-[var(--danger)] text-[var(--danger-fg)] hover:opacity-90"
            : "bg-accent text-accent-fg hover:opacity-90";

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--bg-overlay)] p-4"
            onClick={onCancel}
            data-testid={`${testId}-overlay`}
        >
            <div
                ref={cardRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={`${testId}-title`}
                aria-describedby={`${testId}-message`}
                className="w-full max-w-sm rounded-lg border border-border bg-[var(--bg-elevated)] p-5 shadow-lg"
                onClick={(event) => event.stopPropagation()}
                data-testid={testId}
            >
                <h2
                    id={`${testId}-title`}
                    className="mb-2 text-lg font-semibold text-fg-primary"
                >
                    {title}
                </h2>
                <p
                    id={`${testId}-message`}
                    className="mb-5 text-sm text-fg-secondary"
                >
                    {message}
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="inline-flex min-h-[44px] items-center rounded-md border border-border px-4 text-sm font-medium text-fg-secondary hover:bg-muted"
                        data-testid={`${testId}-cancel`}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-medium ${confirmClass}`}
                        data-testid={`${testId}-confirm`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
