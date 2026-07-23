import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from "react";
import {fallbackString} from "../../i18n/fallbacks";
import {SUPPORTED_LANGUAGES, type SupportedLanguage} from "../../lib/constants";
import {UI_LANGUAGES} from "../../lib/i18n/languages";
import {readLearnerState, setLanguage} from "../../lib/learning/learnerState";
import {getStorage} from "../../storage";
import {setCurrentLanguage} from "../../utils/appState";
import {clearDiscoverSourceLanguage} from "../../lib/content/repos/discoverLanguagePref";
import React from "react";

type I18nStrings = Record<string, unknown>;

interface I18nContextValue {
    t: (key: string, fallback?: string) => string;
    lang: string;
    setLang: (lang: string) => void;
}

function isSupportedLang(value: string): value is SupportedLanguage {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** The 11 shipped UI-language codes — the picker's source of truth
 *  ({@link UI_LANGUAGES}). Used to validate a persisted / derived language,
 *  NOT the stale 5-entry ``SUPPORTED_LANGUAGES`` constant (which would wrongly
 *  reject a saved ``ko`` / ``ja`` / ``hi`` / ``id`` / ``pt`` / ``tr``). */
const UI_LANGUAGE_CODES = new Set(UI_LANGUAGES.map((meta) => meta.code));

/** True when ``code`` is one of the shipped UI languages. */
export function isUiLanguage(code: string | null | undefined): code is string {
    return typeof code === "string" && UI_LANGUAGE_CODES.has(code);
}

/** Normalise a BCP-47 tag (``"de-DE"``, ``"el-GR"``) to its base language
 *  subtag (``"de"``, ``"el"``), lower-cased. ``null`` for an empty/absent
 *  value. Keeps the resolver tolerant of the region-tagged strings
 *  ``navigator.language`` returns. */
function baseLanguageSubtag(locale: string | null | undefined): string | null {
    if (typeof locale !== "string" || locale.length === 0) return null;
    return locale.split("-")[0].toLowerCase();
}

/**
 * Resolve the initial UI language, persisted-choice-first (#1333, #1457).
 *
 * Fallback chain — the user's saved choice ALWAYS wins and is never
 * overwritten (same principle as the Soft-Pop theme default). Only when NO
 * valid choice is stored do we consult, in order:
 *   1. ``saved`` — the persisted UI-language choice.
 *   2. ``browserLocale`` — ``navigator.language`` (base subtag), when it maps
 *      to a shipped UI language. A per-person signal, stronger than a config
 *      default.
 *   3. ``appDefault`` — the explicitly-configured app default (API mode;
 *      Dexie mode carries none).
 *   4. ``"de"`` — the project default.
 *
 * The fallback is NEVER a language-list index: even if it were, position 0
 * of every ordering the app uses is English/German, never Greek (#1457).
 *
 * Pure + exported so the priority is unit-tested without React.
 */
export function resolveInitialUiLanguage(inputs: {
    saved?: string | null;
    browserLocale?: string | null;
    appDefault?: string | null;
}): string {
    if (isUiLanguage(inputs.saved)) return inputs.saved;
    const browser = baseLanguageSubtag(inputs.browserLocale);
    if (isUiLanguage(browser)) return browser;
    if (isUiLanguage(inputs.appDefault)) return inputs.appDefault;
    return "de";
}

/** The persisted UI-language choice from localStorage
 *  (``adaptive-learner.language``), written by the Settings / Landing pickers
 *  in BOTH storage modes. ``null`` when unset or not a shipped UI language.
 *  Exported for the read-seam test (#1333). */
export function readSavedLang(): string | null {
    try {
        const saved = readLearnerState().language;
        if (saved === null) return null;
        if (isUiLanguage(saved)) return saved;
        // #1457 — no silent data loss: a stored value that is not a shipped
        // UI language is ignored (the fallback chain takes over), but the
        // drop is surfaced for debugging rather than swallowed. Never a crash,
        // never a silent swap to another language.
        console.warn(
            `[i18n] Ignoring stored UI language "${saved}" — not a shipped UI language; using the fallback chain.`,
        );
        return null;
    } catch {
        return null;
    }
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level cache to avoid refetching on remount
let cachedLang = "";
let cachedStrings: I18nStrings = {};

/**
 * Clear the module-level catalog cache. TEST-ONLY seam: the cache survives
 * component unmounts by design (avoids refetching on remount), but that means
 * it also survives test boundaries within a file — a catalog loaded by one
 * test would make the next test skip the async first-paint sequence it needs
 * to exercise. Vitest isolates per file, not per test, so a per-test reset is
 * the only way to get a clean first-paint. Not for production use.
 */
export function _resetI18nCacheForTests(): void {
    cachedLang = "";
    cachedStrings = {};
}

/** Capped backoff schedule for the catalog fetch (#1810): 5 retries over
 *  ~31s bridge a backend restart without hammering a dead endpoint. */
const CATALOG_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 16000];

/**
 * Module-level i18n lookup. Walks the same cached catalogue
 * that the in-React ``t()`` uses, so non-React code (notify.ts,
 * service modules) can resolve a translated string without
 * pulling in a hook. Falls back to the supplied default when
 * the key is missing — never throws.
 *
 * Use sparingly. React components should still use ``useI18n``
 * so they re-render on language switch.
 */
export function resolveI18n(key: string, fallback: string): string {
    const parts = key.split(".");
    let current: unknown = cachedStrings;
    for (const part of parts) {
        if (
            current &&
            typeof current === "object" &&
            part in (current as Record<string, unknown>)
        ) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return fallback;
        }
    }
    return typeof current === "string" ? current : fallback;
}

export function I18nProvider({children}: {children: ReactNode}) {
    const [strings, setStrings] = useState<I18nStrings>(cachedStrings);
    // #1333 — start from the PERSISTED choice (localStorage, both storage
    // modes) so a saved UI language survives a reload / PWA update instead of
    // silently falling back to "de". In Dexie mode ``settings.getApp()``
    // returns ``{}`` (no ``default_language``), so before this fix the app
    // always re-initialised to "de" and the saved choice was ignored.
    const [lang, setLangState] = useState(cachedLang || readSavedLang() || "de");

    // Derive the initial language on mount. The persisted choice ALWAYS wins;
    // only when none is stored do we consult the browser locale
    // (navigator.language), then the app-config default, then "de" (#1457).
    useEffect(() => {
        if (cachedLang) return; // already loaded this session
        if (readSavedLang()) return; // persisted choice wins — never overwrite
        const browserLocale =
            typeof navigator !== "undefined" ? navigator.language : null;
        getStorage()
            .settings.getApp()
            .then((config) => {
                const appLang = (config.app as Record<string, unknown>)
                    ?.default_language as string | undefined;
                setLangState(
                    resolveInitialUiLanguage({browserLocale, appDefault: appLang}),
                );
            })
            .catch(() => {
                // App-config unreachable — still honour the browser locale.
                setLangState(resolveInitialUiLanguage({browserLocale}));
            });
    }, []);

    // Fetch strings when the language changes, retrying with capped backoff
    // (#1810). One transient failure (backend restarting, network blip) used
    // to leave the whole session on the inline fallback strings - a
    // mixed-locale UI. While retries run, t() serves the fallback strings;
    // after the final failure the give-up is logged, never swallowed.
    useEffect(() => {
        if (lang === cachedLang && Object.keys(cachedStrings).length > 0) {
            setStrings(cachedStrings);
            return;
        }
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        const attemptFetch = (retryIndex: number) => {
            getStorage()
                .i18n.get(lang)
                .then((data) => {
                    if (cancelled) return;
                    cachedLang = lang;
                    cachedStrings = data;
                    setStrings(data);
                })
                .catch(() => {
                    if (cancelled) return;
                    const delayMs = CATALOG_RETRY_DELAYS_MS[retryIndex];
                    if (delayMs === undefined) {
                        console.warn(
                            `[i18n] Catalog for "${lang}" unreachable after ${
                                CATALOG_RETRY_DELAYS_MS.length + 1
                            } attempts - staying on bundled fallback strings.`,
                        );
                        return;
                    }
                    console.warn(
                        `[i18n] Catalog fetch for "${lang}" failed - retrying in ${delayMs}ms.`,
                    );
                    retryTimer = setTimeout(() => attemptFetch(retryIndex + 1), delayMs);
                });
        };
        attemptFetch(0);
        return () => {
            cancelled = true;
            if (retryTimer !== undefined) clearTimeout(retryTimer);
        };
    }, [lang]);

    // WCAG 2.1 SC 3.1.1 (Language of Page) + SC 3.1.2
    // (Language of Parts): keep <html lang="..."> in sync with
    // the active UI language so screen readers choose the
    // correct pronunciation rules.
    useEffect(() => {
        document.documentElement.lang = lang;
        // Keep the event-recorder app-state snapshot (EVT-02) in sync
        // with the active UI language.
        setCurrentLanguage(lang);
    }, [lang]);

    const setLang = useCallback((newLang: string) => {
        // A UI-language change resets the Discover content-language filter to the
        // new language (it follows the switch, overriding even an explicit "All");
        // a choice made afterwards persists again (#1347). Only on an actual
        // change — never on reload / theme / re-select of the same language.
        if (newLang !== lang) clearDiscoverSourceLanguage();
        setLangState(newLang);
        // #1333 — persist on every switch so the choice survives a reload
        // regardless of which caller changed it (Settings already writes this
        // too; Landing/onboarding did not). localStorage works in both
        // storage modes, so this is the single durable UI-language source.
        try {
            setLanguage(newLang);
        } catch {
            /* localStorage unavailable — best effort */
        }
    }, [lang]);

    const t = useCallback((key: string, fallback?: string): string => {
        // 1) Backend catalog (live strings from
        //    /api/i18n/{lang}). Walk dot-notation path.
        const parts = key.split(".");
        let current: unknown = strings;
        let resolved = true;
        for (const part of parts) {
            if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
                current = (current as Record<string, unknown>)[part];
            } else {
                resolved = false;
                break;
            }
        }
        if (resolved && typeof current === "string") return current;
        // 2) Hardcoded frontend fallbacks (first-paint resilience).
        const localised = isSupportedLang(lang) ? fallbackString(lang, key) : undefined;
        if (localised) return localised;
        // 3) Caller-supplied fallback, then the key itself. Nullish, not
        //    falsy: an explicit empty-string fallback means "render nothing",
        //    never the raw dot-notation key (#1667).
        return fallback ?? key;
    }, [strings, lang]);

    const value: I18nContextValue = {t, lang, setLang};

    return React.createElement(I18nContext.Provider, {value}, children);
}

/**
 * Hook to access i18n translations.
 * Returns {t, lang, setLang} - setLang triggers live language switch.
 */
export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        // Fallback for components rendered outside provider (e.g. tests).
        // ``fallback ?? key`` (not ``||``) so an explicit empty-string
        // fallback means "render nothing", never the raw key (#1676 —
        // same falsy-clobber class as the #1667 provider-path fix).
        return {
            t: (key: string, fallback?: string) => fallback ?? key,
            lang: "de",
            setLang: () => {},
        };
    }
    return ctx;
}
