import type {KeyboardEvent as ReactKeyboardEvent} from "react";

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

/**
 * Submit from a control that owns its own Enter-to-submit (#3357).
 *
 * The control claims every bare Enter (``preventDefault``), whether it can
 * submit yet or not, so the window-level lesson shortcut
 * (``useLessonEnterKey``) steps aside instead of acting on the same key press
 * a second time: after a submit the step is already checked, and the shortcut
 * would advance past the feedback. An Enter that confirms an IME composition
 * or carries a modifier is left alone. Returns true when it submitted.
 *
 * @example
 * <input onKeyDown={(event) => submitOnEnter(event, canCheck, submit)} />
 */
export function submitOnEnter(
    event: ReactKeyboardEvent<HTMLElement>,
    canSubmit: boolean,
    submit: () => void,
): boolean {
    if (!isPlainEnter(event.nativeEvent)) return false;
    event.preventDefault();
    if (!canSubmit) return false;
    submit();
    return true;
}
