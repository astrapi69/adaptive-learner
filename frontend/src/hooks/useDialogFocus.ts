import {useEffect, useRef, type RefObject} from "react";

/**
 * Elements that can receive keyboard focus. ``tabindex="-1"`` is
 * excluded so roving-tabindex groups (e.g. the rating radios) expose
 * only their single active tab stop to the focus trap.
 */
const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(container: HTMLElement): HTMLElement[] {
    return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
}

export interface UseDialogFocusOptions {
    /** Whether the dialog is currently open / mounted. */
    open: boolean;
}

/**
 * Focus management for a hand-rolled modal dialog (WCAG 2.1.2 No
 * Keyboard Trap / 2.4.3 Focus Order). When ``open`` becomes true the
 * hook:
 *
 * 1. remembers the element that had focus (the trigger),
 * 2. moves focus into the dialog — to the element marked
 *    ``data-autofocus`` if present, else the first focusable element,
 *    else the dialog container itself,
 * 3. traps ``Tab`` / ``Shift+Tab`` inside the dialog, and
 * 4. on close / unmount, restores focus to the trigger.
 *
 * The Radix ``ui/dialog`` already does all of this automatically; this
 * hook brings the pre-existing custom ``.modal-overlay`` dialogs (which
 * keep their own DOM + ``data-testid`` contracts) up to the same
 * behaviour without a structural rewrite.
 *
 * A dialog using this hook should NOT also carry its own ``autoFocus``
 * attribute on the same open cycle: that would move focus into the
 * dialog before the hook captures the trigger, defeating focus return.
 * Mark the desired initial element with ``data-autofocus`` instead.
 *
 * @param ref - ref to the ``role="dialog"`` container element.
 * @param options.open - whether the dialog is open.
 *
 * @example
 * const dialogRef = useRef<HTMLDivElement>(null);
 * useDialogFocus(dialogRef, {open});
 * // <div ref={dialogRef} role="dialog" aria-modal="true"> … </div>
 */
export function useDialogFocus(
    ref: RefObject<HTMLElement | null>,
    {open}: UseDialogFocusOptions,
): void {
    const triggerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const dialog = ref.current;
        if (!dialog) return;

        // Remember the trigger so focus can return to it on close.
        // Only capture an element OUTSIDE the dialog so a stray
        // autoFocus or a StrictMode re-run cannot overwrite it with an
        // in-dialog element.
        const active = document.activeElement;
        if (active instanceof HTMLElement && !dialog.contains(active)) {
            triggerRef.current = active;
        }

        const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]");
        const initial = preferred ?? focusableWithin(dialog)[0] ?? dialog;
        if (initial === dialog && !dialog.hasAttribute("tabindex")) {
            dialog.setAttribute("tabindex", "-1");
        }
        initial.focus();

        function handleKeyDown(event: KeyboardEvent): void {
            const node = ref.current;
            if (event.key !== "Tab" || !node) return;
            const focusables = focusableWithin(node);
            if (focusables.length === 0) {
                event.preventDefault();
                node.focus();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement;
            if (event.shiftKey) {
                if (current === first || !node.contains(current)) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (current === last || !node.contains(current)) {
                event.preventDefault();
                first.focus();
            }
        }

        dialog.addEventListener("keydown", handleKeyDown);
        return () => {
            dialog.removeEventListener("keydown", handleKeyDown);
            const trigger = triggerRef.current;
            if (trigger && document.contains(trigger)) {
                trigger.focus();
            }
        };
    }, [open, ref]);
}
