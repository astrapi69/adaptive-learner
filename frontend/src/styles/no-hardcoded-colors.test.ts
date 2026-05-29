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
    "components/DashboardFilterBar.tsx": "user-tag default color (data)",
    // Computed contrast over the FIXED brand method palette — the
    // dot-inset overlay is chosen against METHOD_COLORS by bestTextOn
    // and is theme-independent by construction.
    "components/MethodBadge.tsx": "computed contrast over brand palette",
    "components/QuickStartButton.tsx": "computed contrast over brand palette",
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
