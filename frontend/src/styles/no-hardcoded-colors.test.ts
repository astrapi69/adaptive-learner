/**
 * Phase 58B — no hardcoded colors in component styles.
 *
 * Every visual color in a component must come from a CSS variable so
 * the multi-theme system (Phase 58D) controls it. This test scans
 * every ``.tsx`` under ``src/`` (excluding tests) for color literals
 * (``#hex`` / ``rgb()`` / ``rgba()``) in code (comments stripped) and
 * fails on any that is not covered by the documented allowlist.
 *
 * The allowlist is a RATCHET: it only shrinks. Each entry names the
 * sub-phase that removes it. Do NOT add new entries to make a new
 * violation pass — route the color through a CSS variable instead.
 */

import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join, relative} from "node:path";
import {describe, expect, it} from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

/**
 * Files allowed to contain color literals, each with the reason and
 * the sub-phase that retires it (where applicable). Paths are
 * relative to ``src/``.
 */
const ALLOWLIST: Record<string, string> = {
    // Charts — Recharts needs resolved color strings (not var()).
    // Retired in 58F via a getComputedStyle-based chart-theme helper.
    "components/ProgressTimeline.tsx": "58F chart colors",
    "components/ProfileRadar.tsx": "58F chart colors",
    "components/MethodDistribution.tsx": "58F chart colors",
    // Decorative confetti palette — reviewed for per-theme visibility
    // in 58G rather than tokenized.
    "components/feedback/Confetti.tsx": "decorative particle palette",
    // Camera surfaces — a camera viewport is intentionally black; the
    // scanner modal scrim is intentionally near-opaque for the feed.
    "components/sync/QRScanner.tsx": "camera viewport frame",
    "components/sync/QRScannerModal.tsx": "camera modal scrim",
    // User-tag default seed color — data, not chrome (the user picks
    // a real color; this is only the initial value).
    "components/TagManager.tsx": "user-tag default color (data)",
    "components/ProjectTaxonomy.tsx": "user-tag default color (data)",
    "components/dashboard/DashboardFilterBar.tsx": "user-tag default color (data)",
    // Computed contrast over the FIXED brand method palette — the
    // dot-inset overlay is chosen against METHOD_COLORS by bestTextOn
    // and is theme-independent by construction.
    "components/session/MethodBadge.tsx": "computed contrast over brand palette",
    "components/dashboard/QuickStartButton.tsx": "computed contrast over brand palette",
    // On-brand translucent chip over a colored donation banner.
    "components/about/DonationSection.tsx": "translucent chip on brand banner",
};

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            walk(full, acc);
        } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
            acc.push(full);
        }
    }
    return acc;
}

/** Strip line and block comments so hex/rgb in prose don't trip the scan. */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/;

/**
 * Walk for files ending in ``ext`` under ``dir``, skipping the theme
 * token files (which legitimately hold the raw palette) and tests.
 */
function walkExt(dir: string, ext: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (full.split("\\").join("/").endsWith("styles/themes")) continue;
            walkExt(full, ext, acc);
        } else if (entry.endsWith(ext) && !entry.includes(".test.")) {
            acc.push(full);
        }
    }
    return acc;
}

const CSS_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d/;

/**
 * Color literals are allowed in a non-theme CSS file ONLY as the value
 * of a design-token definition (``--token: <color>``) — the
 * theme-agnostic token layer. A literal in a consumer declaration
 * (``color: #fff``) is a violation unless the line carries an inline
 * ``token-exempt:`` marker explaining why (e.g. a camera viewport).
 * Returns the offending ``line: text`` entries.
 */
function cssConsumerColorViolations(file: string): string[] {
    const lines = readFileSync(file, "utf-8").split("\n");
    const violations: string[] = [];
    let inBlockComment = false;
    lines.forEach((rawLine, index) => {
        let scan = rawLine;
        if (inBlockComment) {
            const end = scan.indexOf("*/");
            if (end === -1) return;
            scan = scan.slice(end + 2);
            inBlockComment = false;
        }
        scan = scan.replace(/\/\*[^]*?\*\//g, "");
        const open = scan.indexOf("/*");
        if (open !== -1) {
            scan = scan.slice(0, open);
            inBlockComment = true;
        }
        if (!CSS_COLOR_RE.test(scan)) return;
        if (scan.trim().startsWith("--")) return; // token definition, allowed
        if (rawLine.includes("token-exempt")) return; // justified consumer
        violations.push(`${index + 1}: ${rawLine.trim()}`);
    });
    return violations;
}

/**
 * Tailwind utilities that bake a fixed palette color (``bg-blue-500``,
 * ``text-red-600``) bypass the theme token layer. New UI must use the
 * variable-backed utilities (``bg-accent`` -> ``var(--accent)``) or an
 * arbitrary value (``bg-[var(--bg-primary)]``).
 */
const TW_PALETTE_RE =
    /\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|placeholder|caret|accent)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-(50|[1-9]00|950)\b/;

describe("Phase 58B — no hardcoded colors in component styles", () => {
    const files = walk(SRC);

    it("scans a non-trivial number of components", () => {
        expect(files.length).toBeGreaterThan(50);
    });

    for (const file of files) {
        const rel = relative(SRC, file).split("\\").join("/");
        const allowed = rel in ALLOWLIST;
        it(`${rel}${allowed ? " (allowlisted)" : ""} has no hardcoded colors`, () => {
            const code = stripComments(readFileSync(file, "utf-8"));
            const hit = COLOR_RE.test(code);
            if (allowed) {
                // Allowlisted files MAY contain a literal; we don't
                // assert they do (so removing the last one in a later
                // sub-phase doesn't fail here — just prune the entry).
                return;
            }
            expect(
                hit,
                `${rel} contains a hardcoded color literal. Route it through a CSS variable.`,
            ).toBe(false);
        });
    }
});

describe("Design tokens — non-theme CSS routes color through tokens", () => {
    const cssFiles = walkExt(SRC, ".css");

    it("scans the non-theme CSS files", () => {
        expect(cssFiles.length).toBeGreaterThan(0);
    });

    for (const file of cssFiles) {
        const rel = relative(SRC, file).split("\\").join("/");
        it(`${rel} has no hardcoded colors in consumer declarations`, () => {
            const violations = cssConsumerColorViolations(file);
            expect(
                violations,
                `${rel} uses raw color literals outside a --token definition:\n` +
                    `${violations.join("\n")}\n` +
                    `Define a token in :root (or the theme files) and reference it, ` +
                    `or mark a justified exception with an inline 'token-exempt:' comment.`,
            ).toEqual([]);
        });
    }
});

describe("Design tokens — no fixed-palette Tailwind utilities", () => {
    const files = walk(SRC);

    for (const file of files) {
        const rel = relative(SRC, file).split("\\").join("/");
        it(`${rel} uses token-backed Tailwind utilities`, () => {
            const code = stripComments(readFileSync(file, "utf-8"));
            const match = code.match(TW_PALETTE_RE);
            expect(
                match,
                `${rel} uses a fixed-palette Tailwind class (${match?.[0]}). ` +
                    `Use a token-backed utility (bg-accent) or bg-[var(--token)].`,
            ).toBeNull();
        });
    }
});
