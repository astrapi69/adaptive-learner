/**
 * #3355 - the single-row desktop bar does not fit below about 1250 px, so the
 * hamburger layout covers everything below ``xl`` (1280 px). The JS query
 * that mounts the drawer and the CSS block that lays it out must agree on
 * that boundary.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COMPACT_NAV_MEDIA_QUERY } from "./Navigation";

/** Largest ``max-width`` (px) among the query's width conditions. */
function maxWidthOf(query: string): number {
    const widths = [...query.matchAll(/max-width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    return Math.max(...widths);
}

describe("compact navigation breakpoint (#3355)", () => {
    it.each([
        { width: 768, compact: true },
        { width: 1024, compact: true },
        { width: 1279, compact: true },
        { width: 1280, compact: false },
    ])("a $width px wide window uses the drawer: $compact", ({ width, compact }) => {
        expect(width <= maxWidthOf(COMPACT_NAV_MEDIA_QUERY)).toBe(compact);
    });

    it("the CSS block that shows the hamburger uses the same breakpoint", () => {
        const css = readFileSync(
            resolve(__dirname, "../../styles/legacy/24-lesson-mode-nav.css"),
            "utf8",
        );
        const block = /@media \(max-width: (\d+)px\) \{\s*\/\* ----- Navigation: hamburger-controlled drawer/.exec(css);
        expect(block).not.toBeNull();
        expect(Number(block?.[1])).toBe(maxWidthOf(COMPACT_NAV_MEDIA_QUERY));
    });
});
