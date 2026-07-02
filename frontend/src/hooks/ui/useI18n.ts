import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from "react";
import {fallbackString} from "../../i18n/fallbacks";
import {SUPPORTED_LANGUAGES, type SupportedLanguage} from "../../lib/constants";
import {UI_LANGUAGES} from "../../lib/i18n/languages";
import {readLearnerState, setLanguage} from "../../lib/learning/learnerState";
import {getStorage} from "../../storage";
import {setCurrentLanguage} from "../../utils/appState";
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

/**
 * Resolve the initial UI language, persisted-choice-first (#1333).
 *
 * The user's saved choice ALWAYS wins — it is never overwritten by the
 * app-config default or the browser locale (same principle as the Soft-Pop
 * theme default). Only when NO valid choice is stored do we derive one from
 * the app config, then the browser locale, then ``"de"``.
 *
 * Pure + exported so the priority is unit-tested without React.
 */
export function resolveInitialUiLanguage(inputs: {
    saved?: string | null;
    appDefault?: string | null;
    navigatorLang?: string | null;
}): string {
    if (isUiLanguage(inputs.saved)) return inputs.saved;
    if (isUiLanguage(inputs.appDefault)) return inputs.appDefault;
    // ``el-GR`` / ``pt-BR`` -> primary subtag.
    const navPrimary = inputs.navigatorLang?.slice(0, 2);
    if (isUiLanguage(navPrimary)) return navPrimary;
    return "de";
}

/** The persisted UI-language choice from localStorage
 *  (``adaptive-learner.language``), written by the Settings / Landing pickers
 *  in BOTH storage modes. ``null`` when unset or not a shipped UI language.
 *  Exported for the read-seam test (#1333). */
export function readSavedLang(): string | null {
    try {
        const saved = readLearnerState().language;
        return isUiLanguage(saved) ? saved : null;
    } catch {
        return null;
    }
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level cache to avoid refetching on remount
let cachedLang = "";
let cachedStrings: I18nStrings = {};

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
    // only when none is stored do we consult the app-config default, then the
    // browser locale, then "de".
    useEffect(() => {
        if (cachedLang) return; // already loaded this session
        if (readSavedLang()) return; // persisted choice wins — never overwrite
        getStorage()
            .settings.getApp()
            .then((config) => {
                const appLang = (config.app as Record<string, unknown>)
                    ?.default_language as string | undefined;
                const navigatorLang =
                    typeof navigator !== "undefined" ? navigator.language : null;
                setLangState(
                    resolveInitialUiLanguage({appDefault: appLang, navigatorLang}),
                );
            })
            .catch(() => {});
    }, []);

    // Fetch strings when language changes
    useEffect(() => {
        if (lang === cachedLang && Object.keys(cachedStrings).length > 0) {
            setStrings(cachedStrings);
            return;
        }
        getStorage()
            .i18n.get(lang)
            .then((data) => {
                cachedLang = lang;
                cachedStrings = data;
                setStrings(data);
            })
            .catch(() => {
                /* Silent bootstrap fallback: t() reverts to fallback strings. */
            });
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
    }, []);

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
        // 3) Caller-supplied fallback, then the key itself.
        return fallback || key;
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
        // Fallback for components rendered outside provider (e.g. tests)
        return {
            t: (key: string, fallback?: string) => fallback || key,
            lang: "de",
            setLang: () => {},
        };
    }
    return ctx;
}
