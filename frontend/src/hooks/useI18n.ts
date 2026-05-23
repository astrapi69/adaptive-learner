import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from "react";
import {fallbackString} from "../i18n/fallbacks";
import {SUPPORTED_LANGUAGES, type SupportedLanguage} from "../lib/constants";
import {getStorage} from "../storage";
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

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level cache to avoid refetching on remount
let cachedLang = "";
let cachedStrings: I18nStrings = {};

export function I18nProvider({children}: {children: ReactNode}) {
    const [strings, setStrings] = useState<I18nStrings>(cachedStrings);
    const [lang, setLangState] = useState(cachedLang || "de");

    // Load language preference from app settings on mount
    useEffect(() => {
        if (cachedLang) return; // already loaded
        getStorage().settings.getApp().then((config) => {
            const appLang = ((config.app as Record<string, unknown>)?.default_language as string) || "de";
            setLangState(appLang);
        }).catch(() => {});
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
    }, [lang]);

    const setLang = useCallback((newLang: string) => {
        setLangState(newLang);
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
