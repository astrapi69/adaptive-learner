/**
 * #2160 — the set-update guard dialog (content.update_guard.*) must be
 * localized in every catalog, not left on the English inline fallback. A
 * fallback a learner cannot read is a data-loss warning that gets clicked
 * through. This gate fails if any non-English catalog carries the English
 * text for these keys, so the untranslated state cannot silently return.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const JSON_DIR = join(__dirname);
const NON_EN = ["de", "el", "es", "fr", "hi", "id", "ja", "ko", "pt", "tr"];
const KEYS = ["title", "message", "confirm", "cancel"] as const;

function guard(lang: string): Record<string, string> {
    const cat = JSON.parse(
        readFileSync(join(JSON_DIR, `${lang}.json`), "utf-8"),
    ) as {content?: {update_guard?: Record<string, string>}};
    return cat.content?.update_guard ?? {};
}

const en = guard("en");

describe("content.update_guard.* is localized in every catalog (#2160)", () => {
    it("every catalog defines all four update_guard keys", () => {
        for (const lang of ["en", ...NON_EN]) {
            const g = guard(lang);
            for (const key of KEYS) {
                expect(g[key], `${lang}.content.update_guard.${key} missing`).toBeTruthy();
            }
        }
    });

    it("the English message keeps the {title}/{cards}/{lessons} placeholders", () => {
        for (const p of ["{title}", "{cards}", "{lessons}"]) {
            expect(en.message).toContain(p);
        }
    });

    for (const lang of NON_EN) {
        it(`${lang} does not fall back to the English text`, () => {
            const g = guard(lang);
            for (const key of KEYS) {
                expect(
                    g[key],
                    `${lang}.content.update_guard.${key} still equals the English fallback`,
                ).not.toBe(en[key]);
            }
        });

        it(`${lang} preserves the message placeholders`, () => {
            for (const p of ["{title}", "{cards}", "{lessons}"]) {
                expect(guard(lang).message).toContain(p);
            }
        });
    }
});
