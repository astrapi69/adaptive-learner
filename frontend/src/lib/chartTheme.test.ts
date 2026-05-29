/**
 * Phase 58F — chart theme resolver. In happy-dom getComputedStyle
 * returns no values for the CSS vars, so readChartTheme falls back to
 * the light palette; we assert the shape + fallback completeness so
 * Recharts always receives concrete colors (never empty strings).
 */

import {describe, expect, it} from "vitest";

import {readChartTheme, tooltipContentStyle} from "./chartTheme";

describe("chartTheme", () => {
    it("returns a complete theme with six series colors", () => {
        const theme = readChartTheme();
        expect(theme.series).toHaveLength(6);
        for (const color of theme.series) {
            expect(color).toMatch(/^#|rgb/);
        }
    });

    it("never yields empty color strings", () => {
        const theme = readChartTheme();
        for (const value of [
            theme.axis,
            theme.grid,
            theme.tooltipBg,
            theme.tooltipBorder,
            theme.tooltipText,
            theme.success,
            theme.error,
            theme.accent,
        ]) {
            expect(value.length).toBeGreaterThan(0);
        }
    });

    it("builds a tooltip content style from the theme", () => {
        const style = tooltipContentStyle(readChartTheme());
        expect(style.background).toBeTruthy();
        expect(style.color).toBeTruthy();
        expect(String(style.border)).toContain("1px solid");
    });
});
