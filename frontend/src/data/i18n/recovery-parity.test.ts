/**
 * #2161 — the ja/ko/zh recovery notice (content.recovery.*) must be localized
 * in every catalog, not left on the English inline fallback. This is a
 * data-touching action (relink / reset review cards), so a text a learner
 * cannot read is worse than for a passive notice. This gate fails if any
 * non-English catalog carries the English text for these keys, so the
 * untranslated state cannot silently return, and it pins the interpolation
 * placeholders so a translation can never drop a {count}/{applied}/... token.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const JSON_DIR = join(__dirname);
const NON_EN = ["de", "el", "es", "fr", "hi", "id", "ja", "ko", "pt", "tr"];
const KEYS = [
    "title",
    "message",
    "backup_hint",
    "backup_action",
    "backup_saved",
    "set_cards",
    "restore",
    "restart",
    "restart_confirm",
    "restart_confirm_yes",
    "restart_cancel",
    "restore_result",
    "restore_unmapped",
    "restart_result",
    "working",
    "failed",
] as const;

/** key -> the placeholders that value MUST keep in every catalog. */
const PLACEHOLDERS: Record<string, string[]> = {
    backup_saved: ["{filename}"],
    set_cards: ["{count}"],
    restore_result: ["{applied}", "{skipped}"],
    restore_unmapped: ["{unmapped}"],
};

function recovery(lang: string): Record<string, string> {
    const cat = JSON.parse(
        readFileSync(join(JSON_DIR, `${lang}.json`), "utf-8"),
    ) as {content?: {recovery?: Record<string, string>}};
    return cat.content?.recovery ?? {};
}

const en = recovery("en");

describe("content.recovery.* is localized in every catalog (#2161)", () => {
    it("every catalog defines all recovery keys", () => {
        for (const lang of ["en", ...NON_EN]) {
            const r = recovery(lang);
            for (const key of KEYS) {
                expect(r[key], `${lang}.content.recovery.${key} missing`).toBeTruthy();
            }
        }
    });

    it("the English values keep their interpolation placeholders", () => {
        for (const [key, tokens] of Object.entries(PLACEHOLDERS)) {
            for (const token of tokens) {
                expect(en[key], `en.${key} lost ${token}`).toContain(token);
            }
        }
    });

    for (const lang of NON_EN) {
        it(`${lang} does not fall back to the English text`, () => {
            const r = recovery(lang);
            for (const key of KEYS) {
                expect(
                    r[key],
                    `${lang}.content.recovery.${key} still equals the English fallback`,
                ).not.toBe(en[key]);
            }
        });

        it(`${lang} preserves every interpolation placeholder`, () => {
            const r = recovery(lang);
            for (const [key, tokens] of Object.entries(PLACEHOLDERS)) {
                for (const token of tokens) {
                    expect(
                        r[key],
                        `${lang}.content.recovery.${key} dropped ${token}`,
                    ).toContain(token);
                }
            }
        });
    }
});
