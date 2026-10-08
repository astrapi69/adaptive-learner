/**
 * One term per concept, in every catalog (#3433).
 *
 * The German catalog said "Sitzung" in the navigation and "Lern-Session" on
 * the page it opens; the streak was "Serie", "Streak" and "Strähne". Japanese
 * showed the same streak number as 現在の連続記録 on one page and 現在のストリーク
 * on the next. Two words for one concept is the same failure as two
 * implementations of one rule: the majority tips per screen. This table is
 * one place the decision lives (``data/i18n-terms.json``); a catalog value
 * that uses a rejected term fails here, so the next translation PR cannot
 * bring it back. The help pages and the help glossary read the same table
 * in ``scripts/verify_docs_help_terms.py`` (verify_docs ``help-terms``),
 * which runs on every PR, help-only ones included.
 *
 * Scope here: the bundled JSON catalogs (generated from backend/config/i18n
 * by make sync-i18n; i18n-sync.test.ts pins the two in sync). Placeholders
 * like ``{streak}`` are stripped first, so a key name inside a template
 * never counts. A new decision is a new row with its issue.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

interface TermRule {
    /** The term the catalog uses for this concept. */
    preferred: string;
    /** A variant that must not appear in any value of this catalog. */
    rejected: RegExp;
    /** Where the decision was made. */
    issue: string;
}

interface TermRow {
    preferred: string;
    rejected: string;
    flags: string;
    issue: string;
}

const TERM_TABLE = join(__dirname, "..", "i18n-terms.json");

const TERMS: Record<string, TermRule[]> = Object.fromEntries(
    Object.entries(
        JSON.parse(readFileSync(TERM_TABLE, "utf-8")) as Record<string, TermRow[]>,
    ).map(([lang, rows]) => [
        lang,
        rows.map((row) => ({
            preferred: row.preferred,
            rejected: new RegExp(row.rejected, row.flags),
            issue: row.issue,
        })),
    ]),
);

const PLACEHOLDER = /\{[^}]*\}/g;

function flatValues(obj: unknown, prefix = "", out: [string, string][] = []): [string, string][] {
    if (typeof obj === "string") {
        out.push([prefix, obj]);
    } else if (obj && typeof obj === "object") {
        for (const [key, value] of Object.entries(obj)) {
            flatValues(value, prefix ? `${prefix}.${key}` : key, out);
        }
    }
    return out;
}

/** Every value of ``catalog`` that uses a rejected term, as "key: value". */
function findRejectedTerms(catalog: unknown, rules: TermRule[]): string[] {
    const hits: string[] = [];
    for (const [key, raw] of flatValues(catalog)) {
        const value = raw.replace(PLACEHOLDER, "");
        for (const rule of rules) {
            if (rule.rejected.test(value)) {
                hits.push(`${key}: ${raw} (use "${rule.preferred}", ${rule.issue})`);
            }
        }
    }
    return hits;
}

function load(lang: string): unknown {
    return JSON.parse(readFileSync(join(__dirname, `${lang}.json`), "utf-8"));
}

describe("one term per concept (#3433)", () => {
    it("reads the term table", () => {
        // #2083 point 4: a missing or empty table would read as clean.
        expect(Object.keys(TERMS).length).toBeGreaterThanOrEqual(4);
        expect(TERMS.de.length).toBeGreaterThanOrEqual(3);
    });

    it.each(Object.keys(TERMS))("the %s catalog uses no rejected term", (lang) => {
        const catalog = load(lang);
        // #2083 point 4: an empty catalog would read as clean.
        expect(flatValues(catalog).length, `${lang}.json holds no values`).toBeGreaterThan(1000);
        expect(findRejectedTerms(catalog, TERMS[lang])).toEqual([]);
    });

    it.each([
        ["a rejected word", {a: "Neue Session starten"}, 1],
        ["a rejected compound part", {a: "Streak-Meilensteine"}, 1],
        ["a placeholder only", {a: "{streak} Serien"}, 0],
        ["the preferred term", {a: "Neue Sitzung starten"}, 0],
        ["a nested value", {a: {b: "Tage-Strähne"}}, 1],
    ])("classifies %s", (_name, catalog, count) => {
        expect(findRejectedTerms(catalog, TERMS.de)).toHaveLength(count);
    });
});
