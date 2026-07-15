/**
 * Phase 39 C7 — WCAG 2.1 SC 2.3.3 (Animation from Interactions)
 * and SC 2.2.2 (Pause, Stop, Hide) regression pin.
 *
 * Reads global.css at test time and asserts that the catch-all
 * ``prefers-reduced-motion: reduce`` block exists with the
 * universal-selector animation/transition reset. The block is
 * the safety net for every animated selector that doesn't
 * carry its own per-rule override.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

const CSS = readLegacyCssSum();

describe("Phase 39 C7 — prefers-reduced-motion catch-all", () => {
    it("global.css contains a universal-selector reduced-motion block", () => {
        // Look for any reduced-motion media block that uses the
        // universal selector ``*`` for the animation reset. The
        // tolerant regex matches whitespace variations + the
        // ``*::before`` / ``*::after`` siblings we ship.
        const re =
            /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*\s*(?:,[^{]*?)?\{[^}]*animation-duration[^}]*\}/s;
        expect(CSS).toMatch(re);
    });

    it("the catch-all block sets transition-duration to a near-zero value", () => {
        // Same block must also reset transitions; otherwise
        // long hover/state transitions still play.
        const re =
            /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*[^}]*?transition-duration:\s*0\.0?\d*m?s\s*!important/s;
        expect(CSS).toMatch(re);
    });

    it("the catch-all block uses !important so component-level overrides cannot win", () => {
        // The catch-all has to beat per-component animation
        // shorthand declarations; !important is mandatory.
        const re =
            /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*[^}]*animation-duration:\s*0\.\d+m?s\s*!important/s;
        expect(CSS).toMatch(re);
    });
});
