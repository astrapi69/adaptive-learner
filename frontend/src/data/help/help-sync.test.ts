/**
 * Drift pin (Phase 38): the bundled JSON files under
 * ``frontend/src/data/help/`` are what the HelpTooltip +
 * HelpDrawer actually read at runtime, in BOTH storage modes
 * (no API roundtrip is required, even in API mode).
 *
 * Backend YAML stays the canonical authoring surface;
 * ``scripts/sync_help_to_frontend.py`` regenerates the JSON.
 *
 * This pin asserts the structural invariants on the JSON side
 * without taking a YAML dep on the frontend:
 *   1. ``concepts.de.json`` + ``concepts.en.json`` exist + parse.
 *   2. Every entry has the canonical shape
 *      (key / title / short / long).
 *   3. The concepts bundle for DE and EN has parity on keys.
 *
 * Future commits in 38A extend this pin (methods, steps,
 * features) without changing the existing assertions.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const HELP_DIR = join(__dirname);

interface Entry {
    key: string;
    title: string;
    short: string;
    long: string;
}

interface Bundle {
    category: string;
    language: string;
    entries: Entry[];
}

function loadBundle(category: string, lang: string): Bundle {
    return JSON.parse(
        readFileSync(join(HELP_DIR, `${category}.${lang}.json`), "utf-8"),
    );
}

describe("help bundles — Concepts", () => {
    const expectedConcepts = new Set([
        "curriculum",
        "learning_project",
        "learning_profile",
        "learning_session",
    ]);

    for (const lang of ["de", "en"] as const) {
        it(`concepts.${lang} parses + contains all four canonical entries`, () => {
            const bundle = loadBundle("concepts", lang);
            expect(bundle.category).toBe("concepts");
            expect(bundle.language).toBe(lang);
            const keys = new Set(bundle.entries.map((e) => e.key));
            for (const expected of expectedConcepts) {
                expect(keys.has(expected)).toBe(true);
            }
        });
    }

    it("every concepts entry has the canonical shape", () => {
        const bundle = loadBundle("concepts", "en");
        for (const entry of bundle.entries) {
            expect(typeof entry.key).toBe("string");
            expect(entry.key.length).toBeGreaterThan(0);
            expect(typeof entry.title).toBe("string");
            expect(entry.title.length).toBeGreaterThan(0);
            expect(typeof entry.short).toBe("string");
            expect(entry.short.length).toBeGreaterThan(0);
            expect(typeof entry.long).toBe("string");
            expect(entry.long).toContain("## ");
        }
    });

    it("DE + EN concepts bundles have identical key sets", () => {
        const de = loadBundle("concepts", "de");
        const en = loadBundle("concepts", "en");
        const deKeys = new Set(de.entries.map((e) => e.key));
        const enKeys = new Set(en.entries.map((e) => e.key));
        expect([...deKeys].sort()).toEqual([...enKeys].sort());
    });
});
