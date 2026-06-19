/**
 * ShortcutHelpDialog — a presentational modal that lists keyboard
 * shortcuts grouped by context (Global / Navigation / Lesson / …). Each
 * row shows the key combo as ``<kbd>`` chips plus a description.
 *
 * App-agnostic and props-driven: it imports nothing app-specific (no
 * i18n, router, or app Dialog wrapper) and renders its own token-backed
 * overlay, so it drops into any app. The parent owns the ``open`` state
 * and closes it (e.g. on Escape or a toggle key) via ``onClose``; the
 * dialog also closes on a backdrop click or the close button.
 *
 * @example
 * <ShortcutHelpDialog
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="Keyboard shortcuts"
 *   closeLabel="Close"
 *   groups={[{
 *     label: "Navigation",
 *     items: [{keys: ["Alt", "D"], description: "Go to dashboard"}],
 *   }]}
 *   testId="shortcut-help"
 * />
 */

import {useEffect, useRef} from "react";

export interface ShortcutHelpItem {
    /** Key tokens rendered as separate ``<kbd>`` chips, e.g. ``["Ctrl", "K"]``. */
    keys: string[];
    description: string;
}

export interface ShortcutHelpGroup {
    label: string;
    items: ShortcutHelpItem[];
}

export interface ShortcutHelpDialogProps {
    open: boolean;
    onClose: () => void;
    /** Dialog heading. */
    title: string;
    /** Accessible label for the close button. */
    closeLabel: string;
    groups: ShortcutHelpGroup[];
    /** ``data-testid`` for the dialog panel. */
    testId?: string;
}

/** Presentational keyboard-shortcut help modal (token-backed). */
export default function ShortcutHelpDialog({
    open,
    onClose,
    title,
    closeLabel,
    groups,
    testId,
}: ShortcutHelpDialogProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) closeRef.current?.focus();
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            data-testid={testId ? `${testId}-overlay` : undefined}
        >
            <button
                type="button"
                aria-label={closeLabel}
                tabIndex={-1}
                onClick={onClose}
                className="absolute inset-0 cursor-default bg-black/50"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcut-help-title"
                className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-xl"
                data-testid={testId}
            >
                <div className="mb-4 flex items-center justify-between gap-2">
                    <h2
                        id="shortcut-help-title"
                        className="text-lg font-semibold text-fg-primary"
                    >
                        {title}
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-bg-secondary"
                        data-testid={testId ? `${testId}-close` : undefined}
                    >
                        ✕
                    </button>
                </div>
                <div className="flex flex-col gap-5">
                    {groups.map((group) => (
                        <section key={group.label}>
                            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
                                {group.label}
                            </h3>
                            <ul className="flex flex-col gap-2">
                                {group.items.map((item) => (
                                    <li
                                        key={item.description}
                                        className="flex items-center justify-between gap-3"
                                    >
                                        <span className="text-sm text-fg-primary">
                                            {item.description}
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1">
                                            {item.keys.map((k, i) => (
                                                <kbd
                                                    key={i}
                                                    className="rounded border border-border-subtle bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-fg-secondary"
                                                >
                                                    {k}
                                                </kbd>
                                            ))}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
