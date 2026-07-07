/**
 * Catalog-level i18n pins for the AI invite card (#1417).
 *
 * The DOM-level assertions in ``AiInviteCard.test.tsx`` /
 * ``Dashboard.test.tsx`` run in whatever locale the test
 * environment resolves. This test pins the rule for ALL 11
 * shipped catalogs directly against the generated JSON bundles:
 *
 *   - every catalog carries the four ``dashboard.ai_invite.*``
 *     strings, non-empty
 *   - none of them uses "API key" / "required" framing (the
 *     inviting tone is a per-language contract, not just German)
 *   - the three dead pre-#1417 keys (``ui.api_key.skip_banner``,
 *     ``.skip_banner_dismiss``, ``.feature_session``) are gone
 *     everywhere (no dead i18n keys)
 */

import {describe, expect, it} from "vitest";

import de from "../../data/i18n/de.json";
import el from "../../data/i18n/el.json";
import en from "../../data/i18n/en.json";
import es from "../../data/i18n/es.json";
import fr from "../../data/i18n/fr.json";
import hi from "../../data/i18n/hi.json";
import id from "../../data/i18n/id.json";
import ja from "../../data/i18n/ja.json";
import ko from "../../data/i18n/ko.json";
import pt from "../../data/i18n/pt.json";
import tr from "../../data/i18n/tr.json";

type Catalog = Record<string, unknown>;
const CATALOGS: Record<string, Catalog> = {de, el, en, es, fr, hi, id, ja, ko, pt, tr};

const INVITE_KEYS = ["title", "body", "connect", "later"] as const;

function section(catalog: Catalog, ...path: string[]): Record<string, unknown> {
    let node: unknown = catalog;
    for (const key of path) {
        node = (node as Record<string, unknown> | undefined)?.[key];
    }
    return (node ?? {}) as Record<string, unknown>;
}

describe("dashboard.ai_invite i18n (#1417)", () => {
    it.each(Object.keys(CATALOGS))(
        "%s carries all four inviting strings without API-key / required wording",
        (lang) => {
            const invite = section(CATALOGS[lang], "dashboard", "ai_invite");
            for (const key of INVITE_KEYS) {
                const value = invite[key];
                expect(value, `${lang}: dashboard.ai_invite.${key}`).toBeTypeOf("string");
                expect((value as string).length, `${lang}: ${key} empty`).toBeGreaterThan(0);
                expect(value as string).not.toMatch(/api[- ]?(key|schl)/i);
                expect(value as string).not.toMatch(/erforderlich|required/i);
            }
        },
    );

    it.each(Object.keys(CATALOGS))(
        "%s no longer carries the dead pre-#1417 banner keys",
        (lang) => {
            const apiKey = section(CATALOGS[lang], "ui", "api_key");
            expect(apiKey).not.toHaveProperty("skip_banner");
            expect(apiKey).not.toHaveProperty("skip_banner_dismiss");
            expect(apiKey).not.toHaveProperty("feature_session");
        },
    );
});
