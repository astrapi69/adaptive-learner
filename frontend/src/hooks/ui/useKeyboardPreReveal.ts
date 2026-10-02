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
 * A SHORT page has no room even then (#3173): three steps, the field at
 * the page end, the content shorter than the shrunk viewport - the late
 * retry is still clamped and the keyboard covers the field. For exactly
 * that remainder the scroller gets ``padding-bottom`` equal to the
 * shortfall, applied ONLY while the keyboard is demonstrably open (the
 * #3017 rule: the hole must always sit under the keyboard) and removed
 * the moment the viewport grows back or focus leaves the keyboard. It
 * is never applied at ``focusin`` (that was #3015, reverted in #3017 for
 * the visible hole it left before the keyboard came up).
 *
 * While the ``?vvdiag=1`` probe is enabled, each applied reveal is
 * logged to the persistent protocol (``kind: "hook"``,
 * ``decision: "prereveal"`` / ``"prereveal-late"`` / ``"prereveal-pad"``)
 * so device readings show the actor.
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

/** What one reveal did: the scroller it moved, the distance it wanted and
 *  the distance the scroller allowed; ``null`` when nothing was to do. */
type RevealOutcome = {
    scroller: HTMLElement;
    delta: number;
    applied: number;
} | null;

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
        const reveal = (el: Element, decision: string): RevealOutcome => {
            const scroller =
                findScrollableAncestor(el) ?? document.getElementById("root");
            if (!scroller) return null;
            const fieldTop = el.getBoundingClientRect().top;
            const safeTop = window.innerHeight * TARGET_VIEWPORT_FRACTION;
            const delta = Math.round(fieldTop - safeTop);
            // Only reveal downward-sitting fields; never yank one UP.
            if (delta <= 0) return null;
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
            return { scroller, delta, applied };
        };

        // #3173 — the scroller that currently carries keyboard headroom.
        let padded: HTMLElement | null = null;
        const clearPadding = () => {
            if (!padded) return;
            padded.style.paddingBottom = "";
            padded = null;
        };
        /** Give the scroller exactly the room the clamped retry lacked, then
         *  reveal again. Only called while the keyboard is demonstrably open,
         *  so the added space is covered by it, never visible (#3017). */
        const padAndReveal = (el: Element, outcome: RevealOutcome) => {
            if (!outcome || outcome.applied >= outcome.delta) return;
            const shortfall = outcome.delta - outcome.applied;
            outcome.scroller.style.paddingBottom = `${shortfall}px`;
            padded = outcome.scroller;
            reveal(el, "prereveal-pad");
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
            clearPadding();
        };

        const viewport = window.visualViewport;
        const onViewportResize = () => {
            if (!viewport) return;
            // Only once the keyboard is demonstrably open: the visible height
            // dropped well below what it was when the field took focus.
            const keyboardOpen =
                heightAtFocus - viewport.height >= KEYBOARD_OPEN_MIN_PX;
            // The keyboard went away: the headroom must go with it, at once,
            // or the hole it filled becomes visible (#3017).
            if (!keyboardOpen) {
                clearPadding();
                return;
            }
            if (retried) return;
            const active = document.activeElement;
            if (!active || !isKeyboardSummoner(active)) return;
            retried = true;
            padAndReveal(active, reveal(active, "prereveal-late"));
        };

        window.addEventListener("focusin", onFocusIn);
        window.addEventListener("focusout", onFocusOut);
        viewport?.addEventListener("resize", onViewportResize);
        return () => {
            clearPadding();
            window.removeEventListener("focusin", onFocusIn);
            window.removeEventListener("focusout", onFocusOut);
            viewport?.removeEventListener("resize", onViewportResize);
        };
    }, []);
}
