/**
 * useVisualViewportRealign (#1569) — reset the iOS phantom window scroll
 * that desyncs taps from their visible targets.
 *
 * The app shell scroll-locks ``html``/``body`` (``overflow: hidden``,
 * #1415) and scrolls ONLY ``#root``. iOS Safari nevertheless scrolls the
 * WINDOW (the layout viewport) to reveal a focused control when the
 * on-screen keyboard opens — and can leave that scroll behind after the
 * keyboard closes, or after a browser-UI (address-bar) reflow of the
 * ``100dvh`` shell. Because nothing in the app ever scrolls the window
 * back, the rendered content stays shifted against the layout hit-test
 * grid: every tap lands ~1-2 lines BELOW the visible target (checkboxes
 * and choice tiles included — no keyboard needed for the offset to
 * linger), and only a first "wasted" tap realigns the viewports.
 *
 * The hook mounts once at the app shell (``App()``, alongside
 * ``useTheme``) and restores the one invariant the scroll-locked shell
 * guarantees — window scroll is always ``(0, 0)`` — whenever the visual
 * viewport settles:
 *
 *   - NEVER while the user is pinch-zoomed (``visualViewport.scale > 1``).
 *     Zoom also shrinks ``visualViewport.height``; conflating the two was
 *     the flaw that got the #1570 shell fix reverted.
 *   - NEVER while the keyboard is open (visual viewport at least
 *     ``KEYBOARD_OPEN_MIN_PX`` shorter than the layout viewport): Safari
 *     owns the reveal scroll there, and yanking it would hide the
 *     focused field. A smaller shrink is browser-UI territory
 *     (address bar), where realigning is safe and wanted.
 *   - NEVER while a text-entry element holds focus (#2983). The shrink
 *     guard alone is structurally wrong under
 *     ``interactive-widget=resizes-content``: iOS (measured on 18.7,
 *     standalone) flips the keyboard-open state between two coordinate
 *     representations, and in the resized one ``innerHeight`` shrinks
 *     WITH ``visualViewport.height`` — the shrink reads 0 while the
 *     keyboard is open, the old hook fired ``scrollTo(0,0)`` into
 *     Safari's focus-reveal, Safari restored it, and the fight repeated
 *     (the oscillation logged in #1569 reading 5). The focused text
 *     field is the representation-independent keyboard signal; a
 *     focus move between two fields (``relatedTarget``) keeps the
 *     guard closed.
 *   - Otherwise, a non-zero ``window.scrollX/Y`` is by construction a
 *     phantom (the shell is scroll-locked) and is reset. Desktop and
 *     Android engines honour the scroll lock, so the reset never fires
 *     there — the hook is inert outside the iOS bug.
 *
 * @example
 * export default function App() {
 *     useTheme();
 *     useVisualViewportRealign();
 *     ...
 * }
 */

import {useEffect} from "react";

/**
 * Minimum visual-viewport shrink (px) that counts as "keyboard open".
 * Same threshold the #1570 attempt used: on-screen keyboards are
 * 250-400px tall, browser-UI (address-bar) reflows are well under 150px.
 */
const KEYBOARD_OPEN_MIN_PX = 150;

/**
 * Input types that never open an on-screen keyboard — focus on these
 * must not block the realign (the #1569 checkbox mis-tap is exactly the
 * case the hook exists for).
 */
const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "radio",
    "range",
    "color",
    "submit",
    "reset",
    "file",
]);

/** Whether ``el`` is a text-entry element that summons the keyboard. */
function isTextEntry(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
        return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
    }
    return (el as HTMLElement).isContentEditable === true;
}

export function useVisualViewportRealign(): void {
    useEffect(() => {
        if (typeof window === "undefined") return;
        const viewport = window.visualViewport;
        // Older engines (and test stubs) may lack visualViewport entirely;
        // degrade to a no-op rather than throwing.
        if (!viewport || typeof viewport.addEventListener !== "function") {
            return;
        }

        const realign = () => {
            // Pinch-zoom shrinks the visual viewport too — never fight it.
            if (viewport.scale > 1.001) return;
            // Keyboard open: Safari's reveal scroll is load-bearing.
            if (window.innerHeight - viewport.height >= KEYBOARD_OPEN_MIN_PX) {
                return;
            }
            // A focused text field means the keyboard is (or is about to
            // be) open even when the shrink reads 0 — the resized
            // representation under interactive-widget=resizes-content
            // (#2983). Safari owns the reveal for as long as it holds.
            if (isTextEntry(document.activeElement)) return;
            if (window.scrollX !== 0 || window.scrollY !== 0) {
                window.scrollTo(0, 0);
            }
        };

        // Keyboard-close does not always fire a resize before the next tap
        // (e.g. focus moving between fields); focusout closes that gap.
        // A move ONTO another text field is not a close (#2983) — the
        // keyboard stays up and the reveal must not be yanked.
        const onFocusOut = (event: FocusEvent) => {
            if (isTextEntry(event.relatedTarget as Element | null)) return;
            realign();
        };

        viewport.addEventListener("resize", realign);
        viewport.addEventListener("scroll", realign);
        window.addEventListener("focusout", onFocusOut);
        return () => {
            viewport.removeEventListener("resize", realign);
            viewport.removeEventListener("scroll", realign);
            window.removeEventListener("focusout", onFocusOut);
        };
    }, []);
}
