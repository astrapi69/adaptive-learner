/**
 * Phase 58D — WCAG 2.1 AA contrast pin across ALL six themes.
 *
 * Reads the actual token values from styles/themes/theme-*.css (the
 * single source of truth) so the pin cannot drift from production CSS.
 * Fails loudly if any contributor lowers a color token below AA in any
 * theme. Originally a light+dark pin (Phase 39 C5); Phase 58D extended
 * it to ocean / forest / high-contrast / sepia.
 */

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {describe, expect, it} from "vitest";

import {METHOD_COLORS, LEARNING_METHODS} from "../lib/constants";
import {THEME_IDS} from "../lib/themes";
import {
    AA_LARGE_TEXT_OR_UI,
    AA_NORMAL_TEXT,
    bestTextOn,
    contrastRatio,
} from "./contrast";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read every ``--name: #hex`` declaration from a theme file. */
function readThemeTokens(themeId: string): Record<string, string> {
    const css = readFileSync(resolve(HERE, "themes", `theme-${themeId}.css`), "utf-8");
    const tokens: Record<string, string> = {};
    const re = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
        tokens[m[1]] = m[2];
    }
    return tokens;
}

const THEME_TOKENS: Record<string, Record<string, string>> = {};
for (const id of THEME_IDS) {
    THEME_TOKENS[id] = readThemeTokens(id);
}

describe("Phase 58D — WCAG AA contrast (all themes)", () => {
    for (const id of THEME_IDS) {
        const t = () => THEME_TOKENS[id];

        describe(`theme=${id}`, () => {
            it("body text on every background passes normal-text AA", () => {
                for (const bg of ["bg-primary", "bg-surface", "bg-elevated"]) {
                    expect(
                        contrastRatio(t()["fg-primary"], t()[bg]),
                        `fg-primary on ${bg}`,
                    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
                }
            });

            it("secondary + muted text on the page background pass normal-text AA", () => {
                expect(
                    contrastRatio(t()["fg-secondary"], t()["bg-primary"]),
                    "fg-secondary on bg-primary",
                ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
                expect(
                    contrastRatio(t()["fg-muted"], t()["bg-primary"]),
                    "fg-muted on bg-primary",
                ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
            });

            it("accent button text passes normal-text AA", () => {
                expect(
                    contrastRatio(t()["accent-fg"], t()["accent"]),
                    "accent-fg on accent",
                ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
            });

            it("status colors as text pass normal-text AA on the page", () => {
                for (const status of ["success", "error", "warning", "info"]) {
                    expect(
                        contrastRatio(t()[status], t()["bg-primary"]),
                        `${status} on bg-primary`,
                    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
                }
            });

            it("exercise feedback colors pass large-text/UI AA on a surface", () => {
                for (const ex of ["exercise-correct", "exercise-wrong"]) {
                    expect(
                        contrastRatio(t()[ex], t()["bg-surface"]),
                        `${ex} on bg-surface`,
                    ).toBeGreaterThanOrEqual(AA_LARGE_TEXT_OR_UI);
                }
            });
        });
    }
});

describe("shadcn accent-foreground passes AA on the brand accent (#82)", () => {
    const bridge = readFileSync(resolve(HERE, "tailwind.css"), "utf-8");

    it("maps --color-accent-foreground to --accent-fg, not --fg-primary", () => {
        const match = bridge.match(
            /--color-accent-foreground:\s*var\((--[a-z-]+)\)/,
        );
        expect(match?.[1], "accent-foreground mapping not found").toBeTruthy();
        expect(match?.[1]).toBe("--accent-fg");
    });

    for (const id of THEME_IDS) {
        it(`theme=${id}: accent-fg on accent passes AA; fg-primary on accent would fail`, () => {
            const tokens = THEME_TOKENS[id];
            expect(
                contrastRatio(tokens["accent-fg"], tokens["accent"]),
                "accent-fg on accent (shipped ghost/outline hover)",
            ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
            expect(
                contrastRatio(tokens["fg-primary"], tokens["accent"]),
                "fg-primary on accent (the regressed mapping) must fail AA",
            ).toBeLessThan(AA_NORMAL_TEXT);
        });
    }
});

describe("Phase 39 C5 — method-badge contrast (WCAG SC 1.4.3)", () => {
    for (const method of LEARNING_METHODS) {
        it(`method=${method}: text color picked by bestTextOn meets AA`, () => {
            const bg = METHOD_COLORS[method];
            const text = bestTextOn(bg);
            expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
    }
});

describe("Phase 39 C5 — bestTextOn helper", () => {
    it("returns the color with the higher contrast ratio", () => {
        expect(bestTextOn("#fafafa")).toBe("#000000");
        expect(bestTextOn("#0f0f10")).toBe("#ffffff");
        expect(bestTextOn("#f59e0b")).toBe("#000000");
    });
});

describe("Phase 39 C5 — contrast helper sanity", () => {
    it("pure black on pure white returns the WCAG ceiling (21:1)", () => {
        expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    });
    it("argument order does not affect the ratio", () => {
        expect(contrastRatio("#1a1a1a", "#ffffff")).toBeCloseTo(
            contrastRatio("#ffffff", "#1a1a1a"),
            5,
        );
    });
});
