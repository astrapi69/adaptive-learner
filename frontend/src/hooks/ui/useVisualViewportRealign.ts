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
            if (window.scrollX !== 0 || window.scrollY !== 0) {
                window.scrollTo(0, 0);
            }
        };

        viewport.addEventListener("resize", realign);
        viewport.addEventListener("scroll", realign);
        // Keyboard-close does not always fire a resize before the next tap
        // (e.g. focus moving between fields); focusout closes that gap.
        window.addEventListener("focusout", realign);
        return () => {
            viewport.removeEventListener("resize", realign);
            viewport.removeEventListener("scroll", realign);
            window.removeEventListener("focusout", realign);
        };
    }, []);
}
