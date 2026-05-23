/**
 * Help glossary loader (Phase 38).
 *
 * Reads the bundled JSON files under
 * ``frontend/src/data/help/{category}.{lang}.json`` via
 * Vite's ``import.meta.glob`` and exposes a typed lookup API.
 * No API roundtrip is required — the JSON ships inside the
 * frontend bundle (regenerated from the authoring YAML by
 * ``make sync-help``). Both storage modes use the same path.
 *
 * Falls back to EN when the requested language has no entry
 * for a key (lingua-franca fallback). Region codes like
 * ``de-DE`` resolve to ``de`` before lookup.
 */

import type {GlossaryEntry} from "../types/help";

const BUNDLES = import.meta.glob<{
    category: string;
    language: string;
    entries: GlossaryEntry[];
}>("../data/help/*.json", {eager: true, import: "default"});

type Bundle = {
    category: string;
    language: string;
    entries: GlossaryEntry[];
};

const CATALOG: Map<string, GlossaryEntry> = (() => {
    const map = new Map<string, GlossaryEntry>();
    for (const [path, bundle] of Object.entries(BUNDLES)) {
        // path: "../data/help/concepts.de.json" -> lang "de"
        const b = bundle as Bundle;
        for (const entry of b.entries) {
            const indexed: GlossaryEntry = {
                ...entry,
                category: b.category as GlossaryEntry["category"],
            };
            map.set(`${b.language}:${entry.key}`, indexed);
        }
    }
    return map;
})();

const SUPPORTED_LANGS = new Set([
    "en",
    "de",
    "es",
    "fr",
    "el",
    "pt",
    "tr",
    "ja",
]);

function resolveLang(lang: string): string {
    if (SUPPORTED_LANGS.has(lang)) return lang;
    const base = lang.split("-")[0]?.toLowerCase();
    return base && SUPPORTED_LANGS.has(base) ? base : "en";
}

/**
 * Look up a single glossary entry by key, with EN fallback.
 * Returns ``null`` if the key does not exist in any catalog.
 */
export function getGlossaryEntry(
    key: string,
    lang: string,
): GlossaryEntry | null {
    const resolved = resolveLang(lang);
    return (
        CATALOG.get(`${resolved}:${key}`) ??
        CATALOG.get(`en:${key}`) ??
        null
    );
}

/**
 * Return every entry for the given language (with EN fallback
 * per-key for missing translations). Stable ordering:
 * concepts -> methods -> steps -> features, then the order
 * inside each YAML file.
 */
export function listGlossaryEntries(
    lang: string,
    options?: {category?: GlossaryEntry["category"]},
): GlossaryEntry[] {
    const resolved = resolveLang(lang);
    const order: GlossaryEntry["category"][] = [
        "concepts",
        "methods",
        "steps",
        "features",
    ];
    const out: GlossaryEntry[] = [];
    const seen = new Set<string>();
    const categories = options?.category ? [options.category] : order;
    for (const category of categories) {
        for (const [path, bundle] of Object.entries(BUNDLES)) {
            const b = bundle as Bundle;
            if (b.category !== category) continue;
            if (b.language !== resolved && b.language !== "en") continue;
            // Prefer the resolved-lang bundle; only fall through
            // to EN for keys missing in the resolved one.
            for (const entry of b.entries) {
                if (seen.has(entry.key)) continue;
                // First time we see this key: take the best
                // available language for it.
                const best =
                    CATALOG.get(`${resolved}:${entry.key}`) ??
                    CATALOG.get(`en:${entry.key}`);
                if (best) {
                    out.push(best);
                    seen.add(entry.key);
                }
            }
            // Mark `path` as touched so unused-var doesn't
            // complain; the loop variable structure mirrors how
            // Vite's import.meta.glob shape works.
            void path;
        }
    }
    return out;
}
