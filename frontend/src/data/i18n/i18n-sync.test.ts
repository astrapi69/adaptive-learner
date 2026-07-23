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
const LANGS = ["de", "el", "en", "es", "fr", "hi", "id", "ja", "ko", "pt", "tr"];

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
    // #1461 — Settings heading collision: the Learning tab's voice
    // section heading (settings.section_voice) must differ from the
    // General tab's display-language heading (settings.section_language).
    // Pre-fix, de rendered "Sprache" for both and tr rendered "Dil" for
    // both — three language-named H2s across two tabs.
    it("keeps the voice heading distinct from the language heading (#1461)", () => {
        for (const lang of LANGS) {
            const settings = loadJson(lang).settings as Record<string, unknown>;
            expect(settings.section_voice, `${lang}: section_voice`).toBeTruthy();
            expect(
                settings.section_voice,
                `${lang}: section_voice must not equal section_language`,
            ).not.toBe(settings.section_language);
        }
    });

    // #1461 — every Learning-tab section heading lives in the settings.*
    // namespace; the SRS heading was the lone outlier (srs.settings_title).
    it("carries the SRS section heading at settings.section_srs (#1461)", () => {
        for (const lang of LANGS) {
            const settings = loadJson(lang).settings as Record<string, unknown>;
            expect(typeof settings.section_srs, `${lang}: section_srs`).toBe(
                "string",
            );
        }
    });

    it("ships all expected languages", () => {
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

    // #1854 — the lesson-summary "Why you missed these" diff called
    // t("review.correct_answer", "Correct:") but no catalog defined the
    // key, so the English fallback rendered in EVERY language next to a
    // correctly translated review.your_answer. Pin both labels.
    it("resolves the summary answer-diff labels in every catalog (#1854)", () => {
        for (const lang of LANGS) {
            const review = loadJson(lang).review as Record<string, unknown>;
            expect(
                typeof review.your_answer,
                `${lang}: review.your_answer`,
            ).toBe("string");
            expect(
                typeof review.correct_answer,
                `${lang}: review.correct_answer (falls back to English ` +
                    `"Correct:" in production when missing)`,
            ).toBe("string");
        }
    });

    // --- repo.* dotted-path regression pin (Phase B1 / v1.33.0)
    //
    // v1.26-1.32 catalogs carried flat keys like ``action_rerender``
    // under ``repo:``; the frontend ``t("repo.action.rerender", ...)``
    // walks dotted paths and never resolved them, falling through
    // to the English fallback in EVERY language. This pin asserts
    // every dotted-path the frontend calls actually resolves in
    // every catalog.
    it("every repo.X.Y key the frontend calls resolves in every catalog", () => {
        // Mirror the exhaustive grep from
        // ``grep -rEho 't\("repo\.[^"]+'  frontend/src/`` so a
        // future drift either at the call site or in the catalog
        // is caught here. Update this list when the frontend
        // adds a new t() call against repo.*.
        const dottedPaths = [
            "repo.action.download_zip",
            "repo.action.persist",
            "repo.action.persisting",
            "repo.action.rerender",
            "repo.error.missing_project",
            "repo.error.persist_failed",
            "repo.error.render_failed",
            "repo.error.zip_failed",
            "repo.loading",
            "repo.page.language",
            "repo.page.rendered_at",
            "repo.page.title",
            "repo.settings.error.load",
            "repo.settings.error.save",
            "repo.settings.loading",
            "repo.settings.repos_dir",
            "repo.settings.save",
            "repo.settings.saving",
            "repo.settings.title",
            "repo.settings.toast.saved",
            "repo.toast.persisted",
            "repo.toast.zip_downloaded",
            "repo.widget.open",
            "repo.widget.title",
        ];
        for (const lang of LANGS) {
            const data = loadJson(lang);
            for (const path of dottedPaths) {
                const parts = path.split(".");
                let cursor: unknown = data;
                for (const part of parts) {
                    if (
                        cursor &&
                        typeof cursor === "object" &&
                        !Array.isArray(cursor) &&
                        part in (cursor as Record<string, unknown>)
                    ) {
                        cursor = (cursor as Record<string, unknown>)[part];
                    } else {
                        cursor = undefined;
                        break;
                    }
                }
                expect(
                    typeof cursor,
                    `${lang}: ${path} did not resolve to a string ` +
                        `(would fall back to English in production)`,
                ).toBe("string");
                expect(
                    (cursor as string).length,
                    `${lang}: ${path} resolved to empty string`,
                ).toBeGreaterThan(0);
            }
        }
    });
});
