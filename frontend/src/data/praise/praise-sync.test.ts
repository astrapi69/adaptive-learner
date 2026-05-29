/**
 * Drift pin (EXP-008 / Phase 55A): the bundled JSON files under
 * ``frontend/src/data/praise/`` are what the praise phrase-picker
 * actually reads at runtime, in BOTH storage modes (no API
 * roundtrip).
 *
 * Backend YAML stays the canonical authoring surface;
 * ``scripts/sync_praise_to_frontend.py`` regenerates the JSON.
 *
 * This pin asserts:
 *   1. All 8 language bundles exist + parse + stamp their lang.
 *   2. Every phrase has the canonical shape (key + non-empty text).
 *   3. Every category has at least its required minimum count.
 *   4. Every language has the SAME key set as EN per category
 *      (the picker tracks used phrases by key, so the key set
 *      must be parallel).
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const PRAISE_DIR = join(__dirname);

const LANGS = ["en", "de", "es", "fr", "el", "pt", "tr", "ja"] as const;
const CATEGORIES = [
    "correct_answer",
    "lesson_complete",
    "streak_milestone",
    "mastery",
    "improvement",
] as const;

// Minimum phrase counts per the Phase 55A spec.
const MIN_COUNTS: Record<(typeof CATEGORIES)[number], number> = {
    correct_answer: 15,
    lesson_complete: 10,
    streak_milestone: 8,
    mastery: 8,
    improvement: 8,
};

interface Phrase {
    key: string;
    text: string;
}

interface Bundle {
    language: string;
    categories: Record<string, Phrase[]>;
}

function loadBundle(lang: string): Bundle {
    return JSON.parse(readFileSync(join(PRAISE_DIR, `${lang}.json`), "utf-8"));
}

describe("praise bundles — structure", () => {
    for (const lang of LANGS) {
        it(`${lang}.json parses and stamps the right language`, () => {
            const bundle = loadBundle(lang);
            expect(bundle.language).toBe(lang);
            for (const category of CATEGORIES) {
                expect(Array.isArray(bundle.categories[category])).toBe(true);
                expect(
                    bundle.categories[category].length,
                ).toBeGreaterThanOrEqual(MIN_COUNTS[category]);
            }
        });

        it(`${lang}.json — every phrase has key + non-empty text`, () => {
            const bundle = loadBundle(lang);
            for (const category of CATEGORIES) {
                for (const phrase of bundle.categories[category]) {
                    expect(typeof phrase.key).toBe("string");
                    expect(phrase.key.length).toBeGreaterThan(0);
                    expect(typeof phrase.text).toBe("string");
                    expect(phrase.text.trim().length).toBeGreaterThan(0);
                }
            }
        });
    }
});

describe("praise bundles — key parity across languages", () => {
    const enKeys: Record<string, string[]> = {};
    const en = loadBundle("en");
    for (const category of CATEGORIES) {
        enKeys[category] = en.categories[category].map((p) => p.key).sort();
    }

    for (const lang of LANGS) {
        it(`${lang} has the same per-category key set as EN`, () => {
            const bundle = loadBundle(lang);
            for (const category of CATEGORIES) {
                const keys = bundle.categories[category]
                    .map((p) => p.key)
                    .sort();
                expect(keys).toEqual(enKeys[category]);
            }
        });
    }
});
