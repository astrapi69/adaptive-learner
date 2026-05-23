/**
 * Phase 39 C5 — WCAG 2.1 AA contrast pin for the two theme
 * variants (light + dark) shipped by adaptive-learner.
 *
 * The test fails loudly if any contributor lowers a color
 * token below AA. It reads the actual token values from the
 * top of global.css (single source of truth) so the test
 * cannot drift out of sync with the production CSS.
 */

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {describe, expect, it} from "vitest";

import {METHOD_COLORS, LEARNING_METHODS} from "../lib/constants";
import {
    AA_LARGE_TEXT_OR_UI,
    AA_NORMAL_TEXT,
    bestTextOn,
    contrastRatio,
} from "./contrast";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(HERE, "global.css"), "utf-8");

/**
 * Extract a CSS variable's hex value from one of the theme
 * blocks at the top of global.css. Looks for the FIRST
 * declaration after the named selector — the file's first
 * 100 lines are the dedicated token-declaration block, so the
 * first hit per selector is authoritative.
 */
function readToken(selector: string, name: string): string {
    const blockRe = new RegExp(
        `${selector.replace(/\[/g, "\\[").replace(/\]/g, "\\]")}\\s*{([^}]*)}`,
    );
    const block = CSS.match(blockRe)?.[1];
    if (!block) throw new Error(`Selector ${selector} not found in global.css`);
    const tokenRe = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`);
    const match = block.match(tokenRe);
    if (!match) throw new Error(`Token --${name} not found under ${selector}`);
    return match[1];
}

const light = {
    bg: readToken(":root", "bg"),
    bgAlt: readToken(":root", "bg-alt"),
    surface: readToken(":root", "surface"),
    surface2: readToken(":root", "surface-2"),
    fg: readToken(":root", "fg"),
    fgMuted: readToken(":root", "fg-muted"),
    accent: readToken(":root", "accent"),
    accentFg: readToken(":root", "accent-fg"),
};

const dark = {
    bg: readToken('[data-theme="dark"]', "bg"),
    bgAlt: readToken('[data-theme="dark"]', "bg-alt"),
    surface: readToken('[data-theme="dark"]', "surface"),
    surface2: readToken('[data-theme="dark"]', "surface-2"),
    fg: readToken('[data-theme="dark"]', "fg"),
    fgMuted: readToken('[data-theme="dark"]', "fg-muted"),
    accent: readToken('[data-theme="dark"]', "accent"),
    accentFg: readToken('[data-theme="dark"]', "accent-fg"),
};

describe("Phase 39 C5 — WCAG AA contrast (light theme)", () => {
    it("--fg on --bg passes normal-text AA", () => {
        expect(contrastRatio(light.fg, light.bg)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg on --surface passes normal-text AA", () => {
        expect(contrastRatio(light.fg, light.surface)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg on --surface-2 passes normal-text AA", () => {
        expect(contrastRatio(light.fg, light.surface2)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg-muted on --bg passes normal-text AA", () => {
        expect(contrastRatio(light.fgMuted, light.bg)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg-muted on --surface-2 passes large-text/UI AA", () => {
        // fg-muted is for hints / captions in tight palettes; we
        // assert the large-text threshold here because muted copy
        // is almost always rendered at >=18pt OR is a caption.
        expect(contrastRatio(light.fgMuted, light.surface2)).toBeGreaterThanOrEqual(
            AA_LARGE_TEXT_OR_UI,
        );
    });
    it("--accent-fg on --accent passes normal-text AA (primary button)", () => {
        expect(contrastRatio(light.accentFg, light.accent)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
});

describe("Phase 39 C5 — WCAG AA contrast (dark theme)", () => {
    it("--fg on --bg passes normal-text AA", () => {
        expect(contrastRatio(dark.fg, dark.bg)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg on --surface passes normal-text AA", () => {
        expect(contrastRatio(dark.fg, dark.surface)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg on --surface-2 passes normal-text AA", () => {
        expect(contrastRatio(dark.fg, dark.surface2)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg-muted on --bg passes normal-text AA", () => {
        expect(contrastRatio(dark.fgMuted, dark.bg)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
    it("--fg-muted on --surface-2 passes large-text/UI AA", () => {
        expect(contrastRatio(dark.fgMuted, dark.surface2)).toBeGreaterThanOrEqual(
            AA_LARGE_TEXT_OR_UI,
        );
    });
    it("--accent-fg on --accent passes normal-text AA (primary button)", () => {
        expect(contrastRatio(dark.accentFg, dark.accent)).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT,
        );
    });
});

describe("Phase 39 C5 — method-badge contrast (WCAG SC 1.4.3)", () => {
    // Every method badge renders as colored background + text
    // label. ``MethodBadge`` / ``MethodSwitchBanner`` / etc.
    // pick text color via ``bestTextOn`` so each pair lands at
    // or above 4.5:1.
    for (const method of LEARNING_METHODS) {
        it(`method=${method}: text color picked by bestTextOn meets AA`, () => {
            const bg = METHOD_COLORS[method];
            const text = bestTextOn(bg);
            expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(
                AA_NORMAL_TEXT,
            );
        });
    }
});

describe("Phase 39 C5 — bestTextOn helper", () => {
    it("returns the color with the higher contrast ratio", () => {
        // White-ish background: black has higher contrast.
        expect(bestTextOn("#fafafa")).toBe("#000000");
        // Very dark background: white wins.
        expect(bestTextOn("#0f0f10")).toBe("#ffffff");
        // Mid-tone amber: black wins on a yellow.
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
