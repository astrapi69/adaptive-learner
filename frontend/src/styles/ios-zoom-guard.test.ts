/**
 * Regression guard for the iOS focus-zoom fix (#1353).
 *
 * iOS Safari zooms IN when a focused text control has an effective
 * font-size < 16px and does not zoom back on blur / step change. The
 * single app-wide backstop is a ``@media (pointer: coarse)`` rule in
 * global.css that floors every focusable text control at 16px on any
 * touch device (iPhone + iPad, all orientations). This test fails if that
 * rule is removed, drops below 16px, or is narrowed to a width breakpoint.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const GLOBAL_CSS = readFileSync(
    join(__dirname, "global.css"),
    "utf-8",
);

describe("iOS focus-zoom guard (#1353)", () => {
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

    it("never suppresses zoom via the viewport meta (WCAG / pinch-zoom)", () => {
        // The fix must be font-size based; the viewport must stay zoomable.
        const indexHtml = readFileSync(
            join(__dirname, "..", "..", "index.html"),
            "utf-8",
        );
        const viewport = indexHtml.match(
            /<meta[^>]*name="viewport"[^>]*>/i,
        )?.[0];
        expect(viewport).toBeTruthy();
        expect(viewport).not.toMatch(/maximum-scale/i);
        expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
    });
});
