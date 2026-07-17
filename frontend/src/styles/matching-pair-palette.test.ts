/**
 * #181 — the Matching exercise's per-pair palette must be RED-FREE.
 *
 * Red universally reads as "wrong", so a correctly matched pair must
 * never be tinted red. The pair colors live in dedicated theme-agnostic
 * ``--matching-pair-N`` tokens in global.css (NOT the shared ``--chart-*``
 * palette, where red is a valid data-series color). This pin reads those
 * tokens straight from global.css and fails if any is a red / error hue,
 * so the palette cannot silently regress to red.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

const GLOBAL_CSS = readLegacyCssSum();

/** Parse ``#rgb`` / ``#rrggbb`` into [h(0-360), s(0-100), l(0-100)]. */
function hsl(hex: string): [number, number, number] {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let hue = 0;
    let sat = 0;
    if (d !== 0) {
        sat = d / (1 - Math.abs(2 * l - 1));
        if (max === r) hue = ((g - b) / d) % 6;
        else if (max === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
    }
    return [hue, sat * 100, l * 100];
}

/** A saturated hue within ~18deg of pure red (0/360) is "error red".
 *  Orange (h~25+) and pink/magenta (h~320-) are explicitly allowed. */
function isRed(hex: string): boolean {
    const [h, s] = hsl(hex);
    return s >= 30 && (h <= 18 || h >= 342);
}

describe("#181 — matching-pair palette is red-free", () => {
    const pairs = [
        ...GLOBAL_CSS.matchAll(
            /--matching-pair-(\d+):\s*(#[0-9a-fA-F]{3,8})\b/g,
        ),
    ].map((m) => [Number(m[1]), m[2]] as [number, string]);

    it("defines a multi-color palette", () => {
        expect(pairs.length).toBeGreaterThanOrEqual(5);
    });

    for (const [n, hex] of pairs) {
        it(`--matching-pair-${n} (${hex}) is not a red / error tone`, () => {
            expect(isRed(hex), `${hex} reads as red`).toBe(false);
        });
    }
});
