/**
 * Shared Enter-key predicates for the lesson keyboard shortcuts
 * (#103 / #154 / #1943).
 *
 * Both ``useLessonEnterKey`` (the step-level Check/Next shortcut) and
 * ``useSummaryEnterKey`` (the summary-level primary-action shortcut)
 * must agree on WHEN a bare Enter keystroke is theirs to act on and
 * WHEN a focused control already owns Enter — so the two predicates
 * live here once instead of being copied per hook.
 */

/** True for a bare Enter keypress that a lesson shortcut should act on:
 *  the Enter key, with no modifier, not an IME composition, and not
 *  already handled (``defaultPrevented``) by another listener. */
export function isPlainEnter(e: KeyboardEvent): boolean {
    return (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.isComposing &&
        !e.defaultPrevented
    );
}

/** True when the focused element already owns Enter (a button, link,
 *  textarea, select, contenteditable, or ``role=button``), so the
 *  lesson shortcut must step aside. */
export function focusOwnsEnter(el: HTMLElement | null): boolean {
    const tag = el?.tagName;
    return (
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable === true ||
        el?.getAttribute("role") === "button"
    );
}
