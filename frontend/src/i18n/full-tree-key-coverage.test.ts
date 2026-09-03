/**
 * Full-tree i18n key-usage coverage (#2864, #2797 Teil A follow-up).
 *
 * Two halves in one file, deliberately:
 *   1. Unit tests for the pure extraction/matching helpers
 *      (full-tree-key-coverage.ts), against small inline fixtures.
 *   2. The actual gate: walks the real `frontend/src` tree, extracts
 *      every `t()` call, and checks static + dynamic keys against the
 *      real 11 catalogs. Per the gate contract (quality-checks.md
 *      #2083 point 4), it prints what it scanned - files, static keys,
 *      dynamic patterns, and the unverifiable bare-identifier count -
 *      so an empty/broken scan can never read as a clean one.
 *
 * Does NOT retire first-paint-coverage.test.ts (#2798): that test
 * answers a different question (is a key reachable during the FIRST
 * PAINT, before the language chunk loads, against the inline fallback
 * subset). This gate checks every t() call site against the full
 * catalogs, tree-wide.
 */

import {readdirSync, readFileSync, statSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

import {
    anyKeyMatchesPattern,
    countBareIdentifierCalls,
    extractDynamicKeyPatterns,
    extractStaticKeys,
    flattenCatalog,
    splitDynamicTemplate,
    stripComments,
} from "./full-tree-key-coverage";

describe("extractStaticKeys", () => {
    it("extracts a plain double-quoted key", () => {
        expect(extractStaticKeys('t("common.loading", "Loading…")')).toEqual([
            "common.loading",
        ]);
    });

    it("extracts a single-quoted key", () => {
        expect(extractStaticKeys("t('a.b', 'x')")).toEqual(["a.b"]);
    });

    it("extracts every key from multiple calls in one source", () => {
        const src = 't("a.b", "x"); later(); t("c.d.e", "y");';
        expect(extractStaticKeys(src)).toEqual(["a.b", "c.d.e"]);
    });

    it("ignores a single-segment key (no dot) - not a valid catalog path", () => {
        expect(extractStaticKeys('t("nodot", "x")')).toEqual([]);
    });

    it("ignores an unrelated t(...) call with a non-key first arg", () => {
        expect(extractStaticKeys("arr.map((t) => t.value)")).toEqual([]);
    });

    it("returns an empty array for source with no t() calls", () => {
        expect(extractStaticKeys("const x = 1;")).toEqual([]);
    });
});

describe("splitDynamicTemplate", () => {
    it("splits a trailing interpolation", () => {
        expect(splitDynamicTemplate("cycle_steps.${key}")).toEqual({
            prefix: "cycle_steps.",
            suffix: "",
        });
    });

    it("splits a mid-template interpolation with a suffix", () => {
        expect(splitDynamicTemplate("create_lesson.templates.${key}.title")).toEqual({
            prefix: "create_lesson.templates.",
            suffix: ".title",
        });
    });

    it("splits an interpolation with a literal suffix right after a prefix ending in _", () => {
        expect(splitDynamicTemplate("resource.type_${type}")).toEqual({
            prefix: "resource.type_",
            suffix: "",
        });
    });

    it("tolerates a nested brace inside the expression", () => {
        expect(splitDynamicTemplate("a.${obj.method({x: 1})}.b")).toEqual({
            prefix: "a.",
            suffix: ".b",
        });
    });

    it("returns null for a template with no interpolation", () => {
        expect(splitDynamicTemplate("plain.no.interpolation")).toBeNull();
    });
});

describe("extractDynamicKeyPatterns", () => {
    it("extracts a single dynamic pattern", () => {
        const src = "t(`cycle_steps.${key}.label`, key)";
        expect(extractDynamicKeyPatterns(src)).toEqual([
            {prefix: "cycle_steps.", suffix: ".label"},
        ]);
    });

    it("deduplicates repeated identical patterns", () => {
        const src =
            "t(`cycle_steps.${a}.label`, a); t(`cycle_steps.${b}.label`, b);";
        expect(extractDynamicKeyPatterns(src)).toEqual([
            {prefix: "cycle_steps.", suffix: ".label"},
        ]);
    });

    it("keeps distinct prefix/suffix pairs separate", () => {
        const src = "t(`a.${x}`, x); t(`b.${x}`, x);";
        const patterns = extractDynamicKeyPatterns(src);
        expect(patterns).toHaveLength(2);
    });

    it("returns an empty array when no template-literal t() calls exist", () => {
        expect(extractDynamicKeyPatterns('t("a.b", "x")')).toEqual([]);
    });
});

describe("countBareIdentifierCalls", () => {
    it("counts a call with a bare variable as the first arg", () => {
        expect(countBareIdentifierCalls("t(metaKey, metaFallback)")).toBe(1);
    });

    it("does not count a properly quoted or templated call", () => {
        expect(
            countBareIdentifierCalls('t("a.b", "x"); t(`c.${d}`, d);'),
        ).toBe(0);
    });

    it("counts multiple bare calls", () => {
        expect(countBareIdentifierCalls("t(a, b); t(c, d);")).toBe(2);
    });
});

describe("flattenCatalog", () => {
    it("flattens a nested object into dot-path leaves", () => {
        const flat = flattenCatalog({a: {b: "x", c: {d: "y"}}});
        expect([...flat.entries()]).toEqual([
            ["a.b", "x"],
            ["a.c.d", "y"],
        ]);
    });

    it("returns an empty map for an empty catalog", () => {
        expect(flattenCatalog({}).size).toBe(0);
    });
});

describe("anyKeyMatchesPattern", () => {
    it("matches a key with the right prefix and suffix", () => {
        const keys = ["cycle_steps.warmup.label", "unrelated.key"];
        expect(
            anyKeyMatchesPattern(keys, {prefix: "cycle_steps.", suffix: ".label"}),
        ).toBe(true);
    });

    it("does not match when no key fits the shape", () => {
        const keys = ["unrelated.key"];
        expect(
            anyKeyMatchesPattern(keys, {prefix: "cycle_steps.", suffix: ".label"}),
        ).toBe(false);
    });

    it("rejects a degenerate match with nothing between prefix and suffix", () => {
        // "cycle_steps.label" == prefix + suffix with an EMPTY gap - not a
        // real dynamic-segment match, just prefix immediately followed by
        // suffix with nothing interpolated.
        const keys = ["cycle_steps.label"];
        expect(
            anyKeyMatchesPattern(keys, {prefix: "cycle_steps.", suffix: "label"}),
        ).toBe(false);
    });
});

describe("stripComments", () => {
    it("removes a line comment, keeping real code on the same line intact", () => {
        expect(stripComments('t("a.b", "x") // see https://example.com')).toBe(
            't("a.b", "x") ',
        );
    });

    it("removes a block comment", () => {
        expect(stripComments('/* t("fake.key", "x") */ real();')).toBe(
            " real();",
        );
    });

    it("removes a multi-line JSDoc-style block comment", () => {
        const src = [
            "/**",
            " * Example: t(\"static.dot.path\", \"Fallback\")",
            " */",
            'real("k")',
        ].join("\n");
        expect(stripComments(src).includes("static.dot.path")).toBe(false);
        expect(stripComments(src)).toContain('real("k")');
    });

    it("leaves code with no comments unchanged", () => {
        expect(stripComments('t("a.b", "x");')).toBe('t("a.b", "x");');
    });
});

// --- The gate itself ---------------------------------------------------

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_DIR = join(SRC, "data", "i18n");
const LANGS = ["de", "el", "en", "es", "fr", "hi", "id", "ja", "ko", "pt", "tr"];

/** Recursively collect every non-test .ts/.tsx file under `dir`. */
function collectSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            out.push(...collectSourceFiles(full));
            continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        if (/\.test\.tsx?$/.test(entry) || entry.endsWith(".d.ts")) continue;
        out.push(full);
    }
    return out;
}

function loadCatalog(lang: string): Map<string, unknown> {
    const raw = JSON.parse(
        readFileSync(join(CATALOG_DIR, `${lang}.json`), "utf-8"),
    ) as Record<string, unknown>;
    return flattenCatalog(raw);
}

describe("full-tree i18n key coverage (#2864)", () => {
    const files = collectSourceFiles(SRC);
    const staticKeys = new Set<string>();
    const dynamicPatterns = new Map<string, ReturnType<typeof extractDynamicKeyPatterns>[number]>();
    let bareCallCount = 0;

    for (const file of files) {
        const source = stripComments(readFileSync(file, "utf-8"));
        for (const key of extractStaticKeys(source)) staticKeys.add(key);
        for (const pattern of extractDynamicKeyPatterns(source)) {
            dynamicPatterns.set(`${pattern.prefix} ${pattern.suffix}`, pattern);
        }
        bareCallCount += countBareIdentifierCalls(source);
    }

    const catalogs = new Map(LANGS.map((lang) => [lang, loadCatalog(lang)]));

    it("scans a non-trivial set of files and calls (fails closed, gate contract #2083)", () => {
        // Without this, a broken walk (wrong path, empty dir) would report
        // "0 issues" and read as clean instead of as "nothing was checked".
        expect(files.length).toBeGreaterThan(500);
        expect(staticKeys.size).toBeGreaterThan(1000);
        console.log(
            `[i18n-full-tree] scanned ${files.length} files: ` +
                `${staticKeys.size} static keys, ${dynamicPatterns.size} dynamic ` +
                `key patterns, ${bareCallCount} unverifiable bare-identifier calls ` +
                "(not checked by this gate - no static tool can resolve them)",
        );
    });

    it.each(LANGS)(
        "%s: every static key used in code resolves to a non-empty catalog value",
        (lang) => {
            const catalog = catalogs.get(lang)!;
            const missing = [...staticKeys].filter((key) => {
                const value = catalog.get(key);
                return typeof value !== "string" || value.trim() === "";
            });
            expect(missing).toEqual([]);
        },
    );

    it.each(LANGS)(
        "%s: every dynamic key pattern used in code fits at least one real catalog key",
        (lang) => {
            const catalog = catalogs.get(lang)!;
            const catalogKeys = [...catalog.keys()];
            const unfitting = [...dynamicPatterns.values()].filter(
                (pattern) => !anyKeyMatchesPattern(catalogKeys, pattern),
            );
            expect(
                unfitting.map((p) => `${p.prefix}<...>${p.suffix}`),
            ).toEqual([]);
        },
    );
});
