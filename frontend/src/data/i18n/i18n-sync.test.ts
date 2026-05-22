/**
 * Drift pin (Phase 29F follow-up): the bundled JSON catalogs
 * under ``frontend/src/data/i18n/`` are what GH Pages users
 * (Dexie mode, no backend) actually read at runtime. The mode
 * of failure is "users see raw dot-notation keys" — what
 * shipped briefly between v1.16.0 and this fix.
 *
 * Backend YAML stays the canonical authoring surface;
 * ``scripts/sync_i18n_to_frontend.py`` regenerates the JSON.
 *
 * This pin asserts the structural invariants on the JSON side
 * without taking a YAML dep on the frontend:
 *   1. All 8 catalogs exist + parse.
 *   2. Every catalog has the same top-level sections as EN.
 *   3. The gamification section (29A-C additions) is present
 *      so a regression on the v1.16.0 launch surface is caught.
 *   4. Every key in EN has a matching key in every other
 *      language (no missing translations at the JSON layer).
 */

import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const JSON_DIR = join(__dirname);
const LANGS = ["de", "el", "en", "es", "fr", "ja", "pt", "tr"];

type Catalog = Record<string, Record<string, unknown>>;

function loadJson(lang: string): Catalog {
    return JSON.parse(
        readFileSync(join(JSON_DIR, `${lang}.json`), "utf-8"),
    );
}

function flatten(obj: Record<string, unknown>, prefix = ""): Set<string> {
    const out = new Set<string>();
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix === "" ? k : `${prefix}.${k}`;
        if (v && typeof v === "object" && !Array.isArray(v)) {
            for (const child of flatten(
                v as Record<string, unknown>,
                key,
            )) {
                out.add(child);
            }
        } else {
            out.add(key);
        }
    }
    return out;
}

describe("i18n JSON catalogs — Dexie-mode bundled source of truth", () => {
    it("ships all 8 expected languages", () => {
        const present = readdirSync(JSON_DIR)
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(/\.json$/, ""))
            .sort();
        expect(present).toEqual([...LANGS].sort());
    });

    it.each(LANGS)("%s.json parses as a non-empty object", (lang) => {
        const data = loadJson(lang);
        expect(data).toBeTruthy();
        expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it("every catalog has the same top-level sections as en.json", () => {
        const enSections = Object.keys(loadJson("en")).sort();
        for (const lang of LANGS) {
            if (lang === "en") continue;
            const sections = Object.keys(loadJson(lang)).sort();
            expect(sections).toEqual(enSections);
        }
    });

    it("every catalog carries the gamification section (v1.16.0)", () => {
        for (const lang of LANGS) {
            const data = loadJson(lang);
            expect(data.gamification).toBeTruthy();
            expect(typeof data.gamification).toBe("object");
        }
    });

    it("every key in en.json is present in every other catalog", () => {
        const enKeys = flatten(loadJson("en"));
        for (const lang of LANGS) {
            if (lang === "en") continue;
            const langKeys = flatten(loadJson(lang));
            const missing = [...enKeys].filter((k) => !langKeys.has(k));
            expect(missing, `${lang} missing keys`).toEqual([]);
        }
    });

    it("contains the v1.16.0 user-facing keys that shipped initially missing", () => {
        // Regression pins for the keys that triggered the
        // post-v1.16.0 raw-key bug report.
        const en = loadJson("en");
        const dashboard = en.dashboard as Record<string, unknown>;
        expect(dashboard.quick_start_subtitle).toBeTruthy();
        const gamification = en.gamification as Record<string, unknown>;
        expect(gamification.card_xp).toBeTruthy();
        expect(gamification.card_badges).toBeTruthy();
        expect(gamification.card_streak).toBeTruthy();
    });
});
