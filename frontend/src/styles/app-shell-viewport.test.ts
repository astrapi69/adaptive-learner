/**
 * #1410 — app-shell viewport pins (landscape iPhone-PWA action-button cutoff).
 *
 * Two invariants keep the lesson action bar reachable in BOTH orientations:
 *
 * 1. The app shell (``html, body, #root``) sizes with ``100dvh`` (dynamic
 *    viewport height) on top of the ``height: 100%`` fallback. ``100%``
 *    resolves against the initial containing block, which iOS does NOT
 *    reliably re-derive across a standalone-PWA orientation change — the
 *    shell (and the sticky footer pinned to its bottom) then stays sized
 *    for the previous orientation and the action button lands below the
 *    visible screen. ``dvh`` is the unit spec'd to track the dynamic
 *    viewport, so the shell follows every rotation / browser-UI change.
 *
 * 2. The ``pb-safe`` Tailwind utility exists in ``tailwind.css`` and pads
 *    with ``max(var(--space-3), env(safe-area-inset-bottom))`` so a
 *    bottom-anchored action bar clears the iOS home-indicator band while
 *    keeping the regular token spacing where the inset is 0.
 */

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("app shell viewport sizing (#1410)", () => {
    const globalCss = readLegacyCssSum();

    it("sizes html/body/#root with 100dvh over the 100% fallback", () => {
        const shellRule = globalCss.match(
            /html,\s*\nbody,\s*\n#root\s*\{[^}]*\}/,
        )?.[0];
        expect(shellRule, "html, body, #root shell rule present").toBeTruthy();
        // Fallback first, dvh second — declaration order IS the fallback
        // mechanism (older engines drop the dvh line).
        const fallbackIdx = shellRule!.indexOf("height: 100%");
        const dvhIdx = shellRule!.indexOf("height: 100dvh");
        expect(fallbackIdx, "height: 100% fallback kept").toBeGreaterThan(-1);
        expect(dvhIdx, "height: 100dvh progressive enhancement").toBeGreaterThan(
            -1,
        );
        expect(dvhIdx, "dvh declared AFTER the % fallback").toBeGreaterThan(
            fallbackIdx,
        );
    });
});

describe("toast container is click-through (#1410)", () => {
    const toastCss = readFileSync(join(HERE, "toast-theme.css"), "utf8");

    it("container never swallows taps; toasts re-enable their own", () => {
        // The fixed bottom-right container spans the whole toast-stack
        // area over the lesson footer; without pointer-events: none it
        // intercepts taps even when the toast inside is passThrough.
        const container = toastCss.match(
            /\.Toastify__toast-container\s*\{[^}]*pointer-events:\s*none[^}]*\}/,
        );
        expect(container, "container pointer-events: none").toBeTruthy();
        const toast = toastCss.match(
            /\.Toastify__toast\s*\{[^}]*pointer-events:\s*auto[^}]*\}/,
        );
        expect(toast, "toast pointer-events: auto").toBeTruthy();
    });
});

describe("pb-safe safe-area utility (#1410)", () => {
    const tailwindCss = readFileSync(join(HERE, "tailwind.css"), "utf8");

    it("defines pb-safe over the space token + safe-area env inset", () => {
        const utility = tailwindCss.match(/@utility pb-safe\s*\{[^}]*\}/)?.[0];
        expect(utility, "@utility pb-safe defined in tailwind.css").toBeTruthy();
        expect(utility).toContain("env(safe-area-inset-bottom");
        expect(utility).toContain("var(--space-3)");
        expect(utility).toContain("max(");
    });
});
