/**
 * Help glossary loader (Phase 38; lazy-split PERF-HELP-GLOSSARY-LAZY-01).
 *
 * Reads the bundled JSON files under
 * ``frontend/src/data/help/{category}.{lang}.json`` and exposes a typed
 * SYNCHRONOUS lookup API. No API roundtrip is required — the JSON ships
 * inside the frontend bundle (regenerated from the authoring YAML by
 * ``make sync-help``). Both storage modes use the same path.
 *
 * Loading strategy (PERF-HELP-GLOSSARY-LAZY-01): only ENGLISH is bundled
 * eagerly (the lingua-franca fallback, always needed, ~50 KB). The other
 * seven languages are LAZY per-language chunks fetched on demand via
 * ``loadGlossaryLanguage`` — they used to be eager-globbed (~412 KB on
 * disk) into the always-mounted HelpDrawer's chunk, so every page load
 * paid for all eight languages. See
 * docs/audits/performance-audit-2026-06-03.md F-3. Mirrors the i18n F-1
 * per-language lazy split.
 *
 * Because EN is always present, the getters stay synchronous and never
 * return null for an existing key: a localized entry resolves once its
 * language has loaded; until then the EN fallback is returned. Region
 * codes like ``de-DE`` resolve to ``de`` before lookup.
 */

import type {GlossaryEntry} from "../../types/help";

type Bundle = {
    category: string;
    language: string;
    entries: GlossaryEntry[];
};

// ENGLISH eager: the lingua-franca fallback is always needed, so it is
// inlined (~50 KB) rather than fetched. Keeps the getters synchronous
// for every key in every language (EN fallback) from the first render.
// Stryker disable all: Vite's import.meta.glob macro is parsed statically by
// the vite:import-glob plugin and requires literal arguments; mutating any
// part of the call breaks the parser (Rolldown PARSE_ERROR). See issue #1956.
const EN_BUNDLES = import.meta.glob<Bundle>("../../data/help/*.en.json", {
    eager: true,
    import: "default",
});
// Stryker restore all

// Every OTHER language lazy: one chunk per ``{category}.{lang}.json``,
// fetched on demand by ``loadGlossaryLanguage``. The negative pattern
// excludes EN so its files are not also emitted as unused lazy chunks.
// Stryker disable all: static arguments required by import.meta.glob (#1956).
const LAZY_BUNDLES = import.meta.glob<Bundle>(
    ["../../data/help/*.json", "!../../data/help/*.en.json"],
    {import: "default"},
);
// Stryker restore all

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

const CATEGORY_ORDER: GlossaryEntry["category"][] = [
    "concepts",
    "methods",
    "steps",
    "features",
];

function resolveLang(lang: string): string {
    if (SUPPORTED_LANGS.has(lang)) return lang;
    const base = lang.split("-")[0]?.toLowerCase();
    return base && SUPPORTED_LANGS.has(base) ? base : "en";
}

// ``${lang}:${key}`` -> entry, populated as each language loads.
const CATALOG = new Map<string, GlossaryEntry>();
// Per-language ordered key list (category order, then file order), the
// stable order ``listGlossaryEntries`` walks.
type OrderedKey = {key: string; category: GlossaryEntry["category"]};
const ORDER = new Map<string, OrderedKey[]>();
const LOADED = new Set<string>();
const IN_FLIGHT = new Map<string, Promise<void>>();
const LISTENERS = new Set<() => void>();

function indexBundle(bundle: Bundle, order: OrderedKey[]): void {
    const category = bundle.category as GlossaryEntry["category"];
    for (const entry of bundle.entries) {
        const indexed: GlossaryEntry = {...entry, category};
        CATALOG.set(`${bundle.language}:${entry.key}`, indexed);
        order.push({key: entry.key, category});
    }
}

// Index EN synchronously at module load from the eager bundles.
(() => {
    const order: OrderedKey[] = [];
    for (const category of CATEGORY_ORDER) {
        const bundle = EN_BUNDLES[`../../data/help/${category}.en.json`];
        if (bundle) indexBundle(bundle as Bundle, order);
    }
    ORDER.set("en", order);
    LOADED.add("en");
})();

function notify(): void {
    for (const listener of LISTENERS) listener();
}

/** Subscribe to glossary-load events (fired after a language's chunks
 *  land). Returns an unsubscribe function. */
export function subscribeGlossary(listener: () => void): () => void {
    LISTENERS.add(listener);
    return () => {
        LISTENERS.delete(listener);
    };
}

/** True when the resolved language's entries are in memory. EN is always
 *  loaded (eager). */
export function isGlossaryLoaded(lang: string): boolean {
    return LOADED.has(resolveLang(lang));
}

/** Load and index one language's four category chunks (idempotent,
 *  de-duplicated across concurrent callers). EN is a no-op (eager). */
async function loadOne(lang: string): Promise<void> {
    if (LOADED.has(lang)) return;
    let pending = IN_FLIGHT.get(lang);
    if (!pending) {
        pending = (async () => {
            const order: OrderedKey[] = [];
            for (const category of CATEGORY_ORDER) {
                const loader = LAZY_BUNDLES[`../../data/help/${category}.${lang}.json`];
                if (!loader) continue;
                indexBundle((await loader()) as Bundle, order);
            }
            ORDER.set(lang, order);
            LOADED.add(lang);
        })().finally(() => IN_FLIGHT.delete(lang));
        IN_FLIGHT.set(lang, pending);
    }
    return pending;
}

/**
 * Lazily load a language's glossary chunks (and ensure EN is available
 * for the per-key fallback). Resolves once the entries are in memory and
 * notifies subscribers so consumers re-render with the localized text.
 * Safe to call repeatedly — EN and already-loaded languages short-circuit.
 */
export async function loadGlossaryLanguage(lang: string): Promise<void> {
    const resolved = resolveLang(lang);
    if (resolved === "en") return; // EN is eager — nothing to fetch.
    if (LOADED.has(resolved)) return;
    await loadOne(resolved);
    notify();
}

/**
 * Look up a single glossary entry by key, with EN fallback. Returns
 * ``null`` only when the key does not exist in ANY catalog. Until the
 * requested language has loaded, the EN entry is returned (then the
 * localized one after ``loadGlossaryLanguage`` resolves + re-renders).
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
 * Return every entry for the given language (with EN fallback per-key
 * for not-yet-loaded / missing translations). Stable ordering:
 * concepts -> methods -> steps -> features, then the order inside each
 * file. EN's order is canonical (always present + the bundles have key
 * parity), so the list is complete even before the localized chunks land.
 */
export function listGlossaryEntries(
    lang: string,
    options?: {category?: GlossaryEntry["category"]},
): GlossaryEntry[] {
    const resolved = resolveLang(lang);
    const order = ORDER.get("en") ?? ORDER.get(resolved) ?? [];
    const out: GlossaryEntry[] = [];
    const seen = new Set<string>();
    for (const {key, category} of order) {
        if (options?.category && category !== options.category) continue;
        if (seen.has(key)) continue;
        const best =
            CATALOG.get(`${resolved}:${key}`) ?? CATALOG.get(`en:${key}`);
        if (best) {
            out.push(best);
            seen.add(key);
        }
    }
    return out;
}
