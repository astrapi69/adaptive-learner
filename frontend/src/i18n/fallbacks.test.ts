import {describe, expect, it} from "vitest";

import {FALLBACK_CATALOGS} from "./fallbacks";
import SHELL_KEYS from "./shell-keys.json";
import {UI_LANGUAGES} from "../lib/i18n/languages";

/**
 * The first-paint fallback catalog MUST mirror the landing keys the shell
 * renders before ``GET /api/i18n/{lang}`` returns. A drift here surfaces as
 * a raw dot-notation key (no caller fallback) or an English string under a
 * non-English locale during the first-paint window (#1902).
 *
 * The file's own header states the sync contract with
 * ``backend/config/i18n/{lang}.yaml``; this pins the landing slice of it so
 * the drift that shipped ``landing.intro`` + ``landing.docs_link`` to the
 * YAML without mirroring them here cannot recur silently.
 */
describe("first-paint fallback catalog — landing keys (#1902)", () => {
    // Every key the Landing shell resolves via t(). If a key is rendered on
    // the landing page it MUST be present in every shipped fallback language,
    // otherwise the first paint under that locale shows a raw key or an
    // English caller-fallback.
    const REQUIRED_LANDING_KEYS = [
        "title",
        "subtitle",
        "intro",
        "choose_language",
        "start_button",
        "docs_link",
    ] as const;

    for (const [lang, catalog] of Object.entries(FALLBACK_CATALOGS)) {
        for (const key of REQUIRED_LANDING_KEYS) {
            it(`${lang}: landing.${key} is present and non-empty`, () => {
                // #2796 — catalog values are now a nested union, so read the
                // group through a narrowing cast instead of a bare index.
                const landing = catalog.landing as
                    | Record<string, string>
                    | undefined;
                const value = landing?.[key];
                expect(value, `fallbacks.ts landing.${key} missing for "${lang}"`).toBeTruthy();
                expect(typeof value).toBe("string");
            });
        }
    }

    it("de resolves landing.intro to German, not the raw key or English", () => {
        const landing = FALLBACK_CATALOGS.de.landing as Record<string, string>;
        const intro = landing.intro;
        expect(intro).toBeDefined();
        expect(intro).not.toBe("landing.intro");
        // Umlaut-carrying German copy — proves it is the localized string,
        // not the English caller-fallback leaking through.
        expect(intro).toContain("für dich");
    });

    it("de resolves landing.docs_link to German, not English", () => {
        const landing = FALLBACK_CATALOGS.de.landing as Record<string, string>;
        expect(landing.docs_link).toBe("Dokumentation lesen");
    });
});

/**
 * #3378 - the first-paint subset is generated from the YAML for every UI
 * language. These pin that it covers all of them and still equals the full
 * catalogs (a stale file means ``make sync-i18n`` was not run).
 */
describe("generated first-paint catalogs (#3378)", () => {
    const catalogs = import.meta.glob<{default: Record<string, unknown>}>(
        "../data/i18n/*.json",
        {eager: true},
    );
    const full = (lang: string): Record<string, unknown> =>
        catalogs[`../data/i18n/${lang}.json`].default;
    const lookup = (catalog: unknown, key: string): unknown =>
        key.split(".").reduce<unknown>(
            (node, part) =>
                node && typeof node === "object"
                    ? (node as Record<string, unknown>)[part]
                    : undefined,
            catalog,
        );

    it("covers every UI language", () => {
        const codes = UI_LANGUAGES.map((meta) => meta.code).sort();
        expect(Object.keys(FALLBACK_CATALOGS).sort()).toEqual(codes);
        expect(codes.length).toBeGreaterThanOrEqual(11);
    });

    it.each(UI_LANGUAGES.map((meta) => meta.code))(
        "%s: every shell key equals the full catalog value",
        (lang) => {
            expect(SHELL_KEYS.length).toBeGreaterThan(100);
            const drift = SHELL_KEYS.filter(
                (key) => lookup(FALLBACK_CATALOGS[lang], key) !== lookup(full(lang), key),
            );
            expect(drift).toEqual([]);
        },
    );

    it("holds exactly the listed shell keys", () => {
        const leaves: string[] = [];
        const walk = (node: unknown, prefix: string): void => {
            if (typeof node === "string") {
                leaves.push(prefix);
                return;
            }
            for (const [key, child] of Object.entries(node as object)) {
                walk(child, prefix ? `${prefix}.${key}` : key);
            }
        };
        walk(FALLBACK_CATALOGS.en, "");
        expect(leaves.sort()).toEqual([...SHELL_KEYS].sort());
    });
});
