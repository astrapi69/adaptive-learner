/**
 * Praise-phrase picker (EXP-008 / Phase 55A).
 *
 * Reads the bundled JSON catalogs under
 * ``frontend/src/data/praise/{lang}.json`` via Vite's
 * ``import.meta.glob`` and exposes a no-repeat phrase picker. No
 * API roundtrip is required - the JSON ships inside the frontend
 * bundle (regenerated from the authoring YAML by
 * ``make sync-praise``). Both storage modes use the same path.
 *
 * No repetition within a session: ``nextPraise`` tracks which
 * keys have been shown per category in module-level memory and
 * cycles through the whole pool before any phrase repeats. The
 * session memory is NOT persisted - a page reload resets it.
 *
 * Falls back to EN when the requested language has no catalog
 * (or no phrases for a category). Region codes like ``de-DE``
 * resolve to ``de`` before lookup.
 */

export type PraiseCategory =
    | "correct_answer"
    | "lesson_complete"
    | "streak_milestone"
    | "mastery"
    | "improvement";

export interface PraisePhrase {
    key: string;
    text: string;
}

export interface PickedPhrase {
    phrase: string;
    key: string;
}

interface PraiseBundle {
    language: string;
    categories: Record<PraiseCategory, PraisePhrase[]>;
}

const BUNDLES = import.meta.glob<PraiseBundle>("../../data/praise/*.json", {
    eager: true,
    import: "default",
});

const CATALOG: Map<string, PraiseBundle> = (() => {
    const map = new Map<string, PraiseBundle>();
    for (const bundle of Object.values(BUNDLES)) {
        const b = bundle as PraiseBundle;
        map.set(b.language, b);
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
 * Return the phrase pool for a category in the resolved
 * language, falling back to EN when the resolved language has no
 * catalog or no phrases for the category. Returns a fresh array
 * each call so callers cannot mutate the catalog.
 */
export function getPhrases(
    category: PraiseCategory,
    lang: string,
): PraisePhrase[] {
    const resolved = resolveLang(lang);
    const fromLang = CATALOG.get(resolved)?.categories?.[category];
    if (fromLang && fromLang.length > 0) return [...fromLang];
    const fromEn = CATALOG.get("en")?.categories?.[category];
    return fromEn ? [...fromEn] : [];
}

/**
 * Pure picker: returns the first phrase in the pool whose key is
 * NOT in ``usedKeys``. When every key has been used, it resets
 * and returns the first phrase in the pool (start of list). This
 * guarantees the full pool cycles before any phrase repeats.
 *
 * Returns ``null`` only when the category has no phrases at all
 * (which never happens for the shipped catalogs).
 */
export function pickPhrase(
    category: PraiseCategory,
    lang: string,
    usedKeys: Set<string>,
): PickedPhrase | null {
    const phrases = getPhrases(category, lang);
    if (phrases.length === 0) return null;
    const fresh = phrases.find((p) => !usedKeys.has(p.key));
    const chosen = fresh ?? phrases[0];
    return {phrase: chosen.text, key: chosen.key};
}

// Session memory: category -> set of keys already shown this
// session. Reset on page reload (module re-evaluation) or via
// ``resetPraiseSession``.
const sessionUsed: Map<PraiseCategory, Set<string>> = new Map();

/**
 * Stateful picker. Returns the next phrase for the category in
 * the given language and records it so it will not be returned
 * again until the whole pool has been shown. When the pool is
 * exhausted the session memory for that category is cleared and
 * cycling restarts from the top.
 */
export function nextPraise(
    category: PraiseCategory,
    lang: string,
): PickedPhrase | null {
    const phrases = getPhrases(category, lang);
    if (phrases.length === 0) return null;
    let used = sessionUsed.get(category);
    if (!used) {
        used = new Set<string>();
        sessionUsed.set(category, used);
    }
    // Pool exhausted: recycle so the next pick is fresh again.
    if (used.size >= phrases.length) used.clear();
    const picked = pickPhrase(category, lang, used);
    if (picked) used.add(picked.key);
    return picked;
}

/**
 * Clear all session phrase-usage tracking. Exposed for tests and
 * for an explicit "new session" reset.
 */
export function resetPraiseSession(): void {
    sessionUsed.clear();
}
