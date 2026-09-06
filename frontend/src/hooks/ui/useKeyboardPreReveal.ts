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
 * While the ``?vvdiag=1`` probe is enabled, each applied reveal is
 * logged to the persistent protocol (``kind: "hook"``,
 * ``decision: "prereveal"``) so device readings show the actor.
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

        const onFocusIn = (event: FocusEvent) => {
            const el = event.target as Element | null;
            if (!el || !isKeyboardSummoner(el)) return;
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
            scroller.scrollTop += delta;
            if (vvDiagEnabled()) {
                appendVvLogEntry({
                    kind: "hook",
                    ts: Date.now(),
                    fix: document.documentElement.dataset.vvfix ?? "off",
                    decision: "prereveal",
                    delta,
                    rootY: Math.round(scroller.scrollTop),
                });
            }
        };

        window.addEventListener("focusin", onFocusIn);
        return () => {
            window.removeEventListener("focusin", onFocusIn);
        };
    }, []);
}
