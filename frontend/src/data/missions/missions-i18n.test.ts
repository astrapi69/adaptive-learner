/**
 * I-102 / Phase 56B: every mission template's ``title_key`` +
 * ``description_key`` must resolve in EVERY i18n catalog (DE+EN
 * handwritten, the other six AI-translated). A missing key would
 * ship a raw dotted path to the user on the missions widget.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const LANGS = ["en", "de", "es", "fr", "el", "pt", "tr", "ja"] as const;

interface Template {
    id: string;
    title_key: string;
    description_key: string;
}

const templates: Template[] = JSON.parse(
    readFileSync(
        join(__dirname, "templates.json"),
        "utf-8",
    ),
).templates;

function loadCatalog(lang: string): Record<string, unknown> {
    return JSON.parse(
        readFileSync(
            join(__dirname, "..", "i18n", `${lang}.json`),
            "utf-8",
        ),
    );
}

function resolve(catalog: Record<string, unknown>, dotted: string): unknown {
    let node: unknown = catalog;
    for (const part of dotted.split(".")) {
        if (node && typeof node === "object" && part in node) {
            node = (node as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return node;
}

describe("mission template i18n keys resolve in every catalog", () => {
    for (const lang of LANGS) {
        it(`${lang}: every template has a non-empty title + description`, () => {
            const catalog = loadCatalog(lang);
            for (const t of templates) {
                const title = resolve(catalog, t.title_key);
                const desc = resolve(catalog, t.description_key);
                expect(
                    typeof title === "string" && title.length > 0,
                    `${lang} missing ${t.title_key}`,
                ).toBe(true);
                expect(
                    typeof desc === "string" && desc.length > 0,
                    `${lang} missing ${t.description_key}`,
                ).toBe(true);
            }
        });
    }
});
