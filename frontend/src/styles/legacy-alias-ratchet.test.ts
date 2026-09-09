/**
 * Legacy-alias ratchet (#3051, backlog item TOKEN-ALIAS-GATE-GAP-01).
 *
 * The three guards in ``no-hardcoded-colors.test.ts`` stop raw color
 * literals and fixed-palette Tailwind classes, but a legacy alias such
 * as ``var(--surface)`` is already ``var()``-bound and passes them.
 * design-tokens.md calls those aliases legacy ("prefer the semantic
 * names in new code"); nothing enforced that, and the consumer count
 * grew from 138 to 156 sites between the backlog filing and #3051.
 *
 * This guard pins the number of ``var(--<alias>)`` references PER ALIAS
 * in consumer TypeScript (``src/components``, ``src/pages``,
 * ``src/shared``; tests excluded) EXACTLY, in both directions
 * (quality-checks.md gate contract, point 5): a new reference fails
 * naming the alias and the delta; a migration that removes references
 * lowers the pin in the same diff, so the table never carries silent
 * headroom. The alias names come from the "Legacy aliases" block of
 * ``styles/legacy/00-head.css`` (fail closed when the block is missing
 * or short), and the scan fails closed on an empty scope.
 *
 * Reproduce one number by hand (from ``frontend/``):
 *
 *   grep -rhoE --include='*.tsx' --include='*.ts' 'var\(--surface\)' \
 *     src/components src/pages src/shared \
 *     --exclude='*.test.ts' --exclude='*.test.tsx' | wc -l
 *
 * Raw text occurrences are counted (comments included, a ``var(--x,
 * fallback)`` form is not) so that grep and this guard always agree.
 */

import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {describe, expect, it} from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");
const LEGACY_HEAD_CSS = join(SRC, "styles", "legacy", "00-head.css");
const CONSUMER_ROOTS = ["components", "pages", "shared"] as const;

/**
 * Per-alias pins, EXACT. Lower a value in the same PR that removes
 * references; raising one is the deliberate act that belongs in a diff.
 */
const LEGACY_ALIAS_PINS: Record<string, number> = {
    bg: 5,
    "bg-alt": 0,
    surface: 100,
    "surface-2": 28,
    "surface-3": 0,
    border: 55,
    "border-strong": 47,
    fg: 19,
    "fg-inverted": 0,
    text: 5,
    "text-muted": 1,
    muted: 0,
    danger: 50,
};

/**
 * Alias names declared in the "Legacy aliases" block of the legacy head
 * CSS: the declarations between that block's comment and the next
 * comment. Empty when the block is absent, which the gate treats as a
 * failure, never as "nothing to check".
 */
function parseLegacyAliases(css: string): string[] {
    const start = css.indexOf("Legacy aliases");
    if (start < 0) return [];
    const rest = css.slice(start);
    const declarationsFrom = rest.indexOf("*/") + 2;
    const nextComment = rest.indexOf("/*", declarationsFrom);
    const block = rest.slice(declarationsFrom, nextComment < 0 ? undefined : nextComment);
    return [...block.matchAll(/^\s*--([a-z0-9-]+):/gm)].map((m) => m[1]);
}

/** Consumer ``.ts``/``.tsx`` files under the three UI roots, tests excluded. */
function walkConsumerFiles(): string[] {
    const acc: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                visit(full);
            } else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) {
                acc.push(full);
            }
        }
    };
    for (const root of CONSUMER_ROOTS) visit(join(SRC, root));
    return acc;
}

/** Raw ``var(--<alias>)`` occurrences per alias, exact name only. */
function countAliasRefs(sources: readonly string[], aliases: readonly string[]): Record<string, number> {
    const counts: Record<string, number> = Object.fromEntries(aliases.map((alias) => [alias, 0]));
    for (const code of sources) {
        for (const alias of aliases) {
            counts[alias] += code.split(`var(--${alias})`).length - 1;
        }
    }
    return counts;
}

/** Every pin/count mismatch, in both directions, as one line each. */
function ratchetViolations(counts: Record<string, number>, pins: Record<string, number>): string[] {
    const lines: string[] = [];
    for (const alias of Object.keys(pins)) {
        if (!(alias in counts)) {
            lines.push(`--${alias}: pinned but not a legacy alias any more; drop the pin`);
        }
    }
    for (const [alias, actual] of Object.entries(counts)) {
        const pinned = pins[alias];
        if (pinned === undefined) {
            lines.push(`--${alias}: legacy alias without a pin; add it to LEGACY_ALIAS_PINS`);
        } else if (actual > pinned) {
            lines.push(
                `--${alias}: ${actual} references, pinned ${pinned} (+${actual - pinned}); use the semantic token instead`,
            );
        } else if (actual < pinned) {
            lines.push(
                `--${alias}: ${actual} references, pinned ${pinned} (-${pinned - actual}); lower the pin in this PR`,
            );
        }
    }
    return lines;
}

describe("legacy alias ratchet: helpers (gate contract, #3051)", () => {
    const pins = {surface: 2, border: 1};

    it("passes when every count equals its pin", () => {
        expect(ratchetViolations({surface: 2, border: 1}, pins)).toEqual([]);
    });

    it("names a grown alias with its delta", () => {
        expect(ratchetViolations({surface: 3, border: 1}, pins)).toEqual([
            expect.stringMatching(/^--surface: 3 references, pinned 2 \(\+1\)/),
        ]);
    });

    it("flags an unexpected shrink so the pin gets lowered", () => {
        expect(ratchetViolations({surface: 2, border: 0}, pins)).toEqual([
            expect.stringMatching(/^--border: 0 references, pinned 1 \(-1\)/),
        ]);
    });

    it("flags an alias without a pin and a pin without an alias", () => {
        expect(ratchetViolations({surface: 2, border: 1, fg: 0}, pins)).toEqual([
            expect.stringMatching(/^--fg: legacy alias without a pin/),
        ]);
        expect(ratchetViolations({surface: 2}, pins)).toEqual([
            expect.stringMatching(/^--border: pinned but not a legacy alias/),
        ]);
    });

    it("counts raw var(--alias) occurrences per alias, exact name only", () => {
        const code = 'className="bg-[var(--surface)] border-[var(--surface-2)]" /* var(--surface) */ var(--fg, red)';
        expect(countAliasRefs([code], ["surface", "surface-2", "fg"])).toEqual({
            surface: 2,
            "surface-2": 1,
            fg: 0,
        });
    });

    it("reads the alias names from the legacy block only", () => {
        const css = [
            ":root {",
            "  --radius-1: 1px;",
            "  /* Legacy aliases. Kept for old CSS. */",
            "  --surface: var(--bg-surface);",
            "  --danger: var(--error);",
            "",
            "  /* Theme-agnostic tokens. */",
            "  --danger-fg: #ffffff;",
            "}",
        ].join("\n");
        expect(parseLegacyAliases(css)).toEqual(["surface", "danger"]);
    });

    it("yields nothing when the legacy block is absent (the gate then fails closed)", () => {
        expect(parseLegacyAliases(":root { --surface: red; }")).toEqual([]);
    });
});

describe("legacy alias ratchet: consumer TypeScript (#3051)", () => {
    const aliases = parseLegacyAliases(readFileSync(LEGACY_HEAD_CSS, "utf-8"));
    const files = walkConsumerFiles();
    const counts = countAliasRefs(
        files.map((file) => readFileSync(file, "utf-8")),
        aliases,
    );

    it("reads a non-trivial legacy alias block (fail closed)", () => {
        expect(aliases.length).toBeGreaterThanOrEqual(10);
    });

    it("scans a non-trivial consumer scope (fail closed)", () => {
        expect(files.length).toBeGreaterThan(300);
    });

    it("every legacy alias count equals its pin", () => {
        const violations = ratchetViolations(counts, LEGACY_ALIAS_PINS);
        expect(
            violations,
            `legacy alias references drifted from LEGACY_ALIAS_PINS ` +
                `(scanned ${files.length} files under src/{${CONSUMER_ROOTS.join(",")}}):\n` +
                `${violations.join("\n")}\nmeasured: ${JSON.stringify(counts)}`,
        ).toEqual([]);
    });
});
