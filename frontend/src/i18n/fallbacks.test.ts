import {describe, expect, it} from "vitest";

import {FALLBACK_CATALOGS, fallbackString} from "./fallbacks";

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
                const value = catalog.landing?.[key];
                expect(value, `fallbacks.ts landing.${key} missing for "${lang}"`).toBeTruthy();
                expect(typeof value).toBe("string");
            });
        }
    }

    it("de resolves landing.intro to German, not the raw key or English", () => {
        const intro = fallbackString("de", "landing.intro");
        expect(intro).toBeDefined();
        expect(intro).not.toBe("landing.intro");
        // Umlaut-carrying German copy — proves it is the localized string,
        // not the English caller-fallback leaking through.
        expect(intro).toContain("für dich");
    });

    it("de resolves landing.docs_link to German, not English", () => {
        expect(fallbackString("de", "landing.docs_link")).toBe("Dokumentation lesen");
    });
});
