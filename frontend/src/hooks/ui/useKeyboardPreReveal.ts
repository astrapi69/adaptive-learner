/**
 * useKeyboardPreReveal (#3002) — scroll a focused text field into the
 * upper third of the viewport BEFORE iOS evaluates caret visibility.
 *
 * Reading 6 of the #1569 loop (the first from a verified fix build)
 * pinned the remaining mechanism: ``@rootY=0`` in every measurement —
 * the app never scrolls a focused field above the keyboard itself, so
 * Safari reveals it by PANNING the visual viewport (``winY=vvTop`` up
 * to ~470 px), and every tap while the field stays focused lands in
 * that shifted grid. The #2984 realign fix correctly stands down there
 * (yanking Safari's reveal was the #1570/#1832 mistake), so the pan can
 * only be prevented, not repaired: reveal the field ourselves, in the
 * app's own scroller, synchronously inside ``focusin`` — then Safari's
 * reveal finds the caret already visible and never pans. This is the
 * community-established remedy for the class (see the #1569 research
 * dossier, 2026-09-05).
 *
 * Scope guards:
 *   - Touch devices only (``pointer: coarse``) — desktop keyboards do
 *     not overlay the page, and jumping fields around on click would be
 *     pure annoyance there.
 *   - Only elements that summon the keyboard (no ``select``: the iOS
 *     picker overlays instead of panning to a caret).
 *   - Only DOWNWARD reveals: a field already at or above the safe band
 *     is left alone.
 *   - The scroll targets the nearest scrollable ancestor (fallback
 *     ``#root``, the shell's only legitimate scroller, #1415) and is
 *     applied synchronously (no smooth animation) so it wins the race
 *     against Safari's own reveal evaluation.
 *
 * The reveal runs TWICE per focus episode (#3019). At ``focusin`` the
 * shell still measures ``100dvh`` with the content exactly filling it
 * (measured: ``docH === innerH``), so there is NO scroll room and the
 * reveal is clamped (reading 8: wanted 218 px, applied 61). Moments
 * later the keyboard opens, ``interactive-widget=resizes-content``
 * shrinks the layout viewport (``innerH`` 895 -> 421) and the same
 * content now overflows a much shorter scroller — roughly 474 px of
 * room appear. A ``visualViewport`` resize listener therefore retries
 * the reveal once, when the room finally exists. Only the app scroller
 * moves, never ``window``, so this never competes with Safari's pan
 * channel (the #1832 mistake), and nothing about the layout changes —
 * the padding approach that did was reverted in #3017.
 *
 * While the ``?vvdiag=1`` probe is enabled, each applied reveal is
 * logged to the persistent protocol (``kind: "hook"``,
 * ``decision: "prereveal"`` / ``"prereveal-late"``) so device readings
 * show the actor.
 *
 * @example
 * export default function App() {
 *     useVisualViewportRealign();
 *     useKeyboardPreReveal();
 *     ...
 * }
 */

import {useEffect} from "react";

import {appendVvLogEntry, vvDiagEnabled} from "../../lib/diagnostics/vv-log";
import {isKeyboardSummoner} from "../../lib/viewport/keyboard-focus";

/**
 * Where the focused field's top should sit, as a fraction of the
 * pre-keyboard viewport height. One third keeps the field comfortably
 * above every plausible keyboard (the measured keyboard covered the
 * lower ~53% of the screen) while leaving its context visible above.
 */
const TARGET_VIEWPORT_FRACTION = 1 / 3;

/**
 * Minimum visual-viewport shrink (px) that counts as "keyboard open" —
 * the same threshold ``useVisualViewportRealign`` uses, so both hooks
 * agree on when Safari owns the reveal.
 */
const KEYBOARD_OPEN_MIN_PX = 150;

/** The nearest ancestor that can actually scroll vertically. */
function findScrollableAncestor(el: Element): HTMLElement | null {
    let node = el.parentElement;
    while (node) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (
            (overflowY === "auto" || overflowY === "scroll") &&
            node.scrollHeight > node.clientHeight
        ) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

export function useKeyboardPreReveal(): void {
    useEffect(() => {
        if (typeof window === "undefined") return;
        // Desktop keyboards do not overlay the page — never move fields
        // around there. (matchMedia is absent in some old stubs: no-op.)
        if (!window.matchMedia?.("(pointer: coarse)").matches) return;

        /**
         * Scroll ``el`` into the safe band, as far as the scroller allows.
         * Returns what was actually applied — the ``focusin`` pass is
         * routinely clamped to a fraction of it (#3019), which is why the
         * keyboard-open retry below exists.
         */
        const reveal = (el: Element, decision: string): void => {
            const scroller =
                findScrollableAncestor(el) ?? document.getElementById("root");
            if (!scroller) return;
            const fieldTop = el.getBoundingClientRect().top;
            const safeTop = window.innerHeight * TARGET_VIEWPORT_FRACTION;
            const delta = Math.round(fieldTop - safeTop);
            // Only reveal downward-sitting fields; never yank one UP.
            if (delta <= 0) return;
            // Synchronous, instant: must be applied before Safari decides
            // whether the caret needs its own reveal scroll.
            const before = scroller.scrollTop;
            scroller.scrollTop = before + delta;
            const applied = Math.round(scroller.scrollTop - before);
            if (vvDiagEnabled()) {
                appendVvLogEntry({
                    kind: "hook",
                    ts: Date.now(),
                    fix: document.documentElement.dataset.vvfix ?? "off",
                    decision,
                    delta,
                    applied,
                    rootY: Math.round(scroller.scrollTop),
                });
            }
        };

        // One late retry per focus episode: the room only exists once the
        // keyboard has shrunk the layout viewport (#3019).
        let retried = false;
        // The visible height at focus time. The retry compares against THIS,
        // not against ``innerHeight - viewport.height``: under
        // interactive-widget=resizes-content both shrink together, so that
        // difference reads 0 while the keyboard is wide open — the very trap
        // that made the realign hook fight Safari (#2983).
        let heightAtFocus = 0;

        const onFocusIn = (event: FocusEvent) => {
            const el = event.target as Element | null;
            if (!el || !isKeyboardSummoner(el)) return;
            retried = false;
            heightAtFocus = window.visualViewport?.height ?? window.innerHeight;
            reveal(el, "prereveal");
        };

        // The keyboard context ends when focus leaves for a non-summoner;
        // a field-to-field move keeps the episode (keyboard stays up).
        const onFocusOut = (event: FocusEvent) => {
            if (isKeyboardSummoner(event.relatedTarget as Element | null)) {
                return;
            }
            retried = true;
        };

        const viewport = window.visualViewport;
        const onViewportResize = () => {
            if (retried || !viewport) return;
            // Only once the keyboard is demonstrably open: the visible height
            // dropped well below what it was when the field took focus.
            if (heightAtFocus - viewport.height < KEYBOARD_OPEN_MIN_PX) {
                return;
            }
            const active = document.activeElement;
            if (!active || !isKeyboardSummoner(active)) return;
            retried = true;
            reveal(active, "prereveal-late");
        };

        window.addEventListener("focusin", onFocusIn);
        window.addEventListener("focusout", onFocusOut);
        viewport?.addEventListener("resize", onViewportResize);
        return () => {
            window.removeEventListener("focusin", onFocusIn);
            window.removeEventListener("focusout", onFocusOut);
            viewport?.removeEventListener("resize", onViewportResize);
        };
    }, []);
}
