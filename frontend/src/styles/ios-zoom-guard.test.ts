/**
 * Regression guard for the iOS focus-zoom fix (#1353) + the #1569 revision.
 *
 * iOS Safari zooms IN when a focused text control has an effective
 * font-size < 16px and does not zoom back on blur / step change. The
 * PRIMARY, WCAG-safe defence is a ``@media (pointer: coarse)`` rule in
 * global.css that floors every focusable text control at 16px on any
 * touch device (iPhone + iPad, all orientations). This test fails if that
 * rule is removed, drops below 16px, or is narrowed to a width breakpoint.
 *
 * #1569 deliberately revised the original "never use maximum-scale" stance:
 * on an installed iPhone PWA the caret/touch hit-test desynced despite the
 * 16px floor, so the viewport additionally carries
 * ``maximum-scale=1.0, user-scalable=no`` as a belt-and-suspenders (iOS >=10
 * still honours the user's pinch-zoom, so resize-text is preserved). The
 * second test below therefore no longer forbids zoom-suppression outright;
 * it enforces that the viewport keeps its responsive base AND that any
 * zoom-suppression stays DOCUMENTED (cites #1569), so it can never silently
 * regress into an undocumented naive zoom lock. The 16px floor stays primary.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

const GLOBAL_CSS = readLegacyCssSum();

describe("iOS focus-zoom guard (#1353, #1569)", () => {
    it("floors focusable text controls at 16px on coarse pointers", () => {
        // The block must be keyed on pointer type (touch), NOT a width
        // breakpoint, so it also covers iPad portrait > 768px.
        const match = GLOBAL_CSS.match(
            /@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/,
        );
        expect(match, "a @media (pointer: coarse) block must exist").not.toBeNull();
        const body = match![1];
        expect(body).toMatch(/textarea/);
        expect(body).toMatch(/select/);
        expect(body).toMatch(/input/);
        // 16px is the iOS zoom threshold — never floor below it.
        expect(body).toMatch(/font-size:\s*16px/);
    });

    it("keeps a responsive viewport and documents any #1569 zoom-suppression", () => {
        // The 16px floor (above) is the primary defence. The viewport must
        // keep its responsive base; if it additionally suppresses zoom for
        // the #1569 caret-desync case, that trade-off must stay documented.
        const indexHtml = readFileSync(
            join(__dirname, "..", "..", "index.html"),
            "utf-8",
        );
        const viewport = indexHtml.match(
            /<meta[^>]*name="viewport"[^>]*>/i,
        )?.[0];
        expect(viewport, "a viewport meta must exist").toBeTruthy();
        // Responsive base is non-negotiable regardless of the #1569 revision.
        expect(viewport).toMatch(/width\s*=\s*device-width/i);
        expect(viewport).toMatch(/initial-scale\s*=\s*1(\.0)?/i);
        // Zoom-suppression is allowed ONLY as the deliberate, documented
        // #1569 belt-and-suspenders — never as an undocumented naive lock.
        const suppressesZoom = /maximum-scale|user-scalable\s*=\s*no/i.test(
            viewport!,
        );
        if (suppressesZoom) {
            expect(
                indexHtml,
                "viewport zoom-suppression must cite the #1569 WCAG trade-off",
            ).toMatch(/#1569/);
        }
    });
});
