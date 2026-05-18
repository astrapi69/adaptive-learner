/**
 * Inline DE + EN fallback strings for the keys the React shell
 * renders before ``GET /api/i18n/{lang}`` returns.
 *
 * Backend YAML catalogs (``backend/config/i18n/{de,en}.yaml``) are
 * the single source of truth at runtime; this module is the
 * conservative fallback so the app never renders raw dot-notation
 * keys (``onboarding.title``) on first paint or when offline.
 *
 * Keep ``backend/config/i18n/{de,en}.yaml`` and the strings below
 * in sync — the union of keys defined here is what the shell will
 * render on its own. New keys go into the YAML first; mirror them
 * here only for the very first paint of the relevant page.
 */

import type {SupportedLanguage} from "../lib/constants";

type Catalog = Record<string, Record<string, string>>;

const DE: Catalog = {
    app: {
        name: "Adaptive Learner",
        tagline: "Adaptives Lernen nach dem Sechs-Methoden-Modell.",
    },
    landing: {
        title: "Adaptive Learner",
        subtitle: "Lernen, das sich an dich anpasst.",
        choose_language: "Sprache waehlen",
        start_button: "Lernreise beginnen",
    },
    nav: {
        dashboard: "Dashboard",
        session: "Session",
        progress: "Fortschritt",
        settings: "Einstellungen",
    },
    common: {
        loading: "Laedt …",
        error: "Etwas ist schiefgegangen.",
        cancel: "Abbrechen",
        save: "Speichern",
        next: "Weiter",
        back: "Zurueck",
        submit: "Absenden",
    },
};

const EN: Catalog = {
    app: {
        name: "Adaptive Learner",
        tagline: "Learning that adapts to you.",
    },
    landing: {
        title: "Adaptive Learner",
        subtitle: "Learning that adapts to you.",
        choose_language: "Choose your language",
        start_button: "Start your learning journey",
    },
    nav: {
        dashboard: "Dashboard",
        session: "Session",
        progress: "Progress",
        settings: "Settings",
    },
    common: {
        loading: "Loading…",
        error: "Something went wrong.",
        cancel: "Cancel",
        save: "Save",
        next: "Next",
        back: "Back",
        submit: "Submit",
    },
};

const FALLBACKS: Record<SupportedLanguage, Catalog> = {de: DE, en: EN};

/**
 * Resolve a dot-notation key against the fallback catalog. Returns
 * ``undefined`` if neither bucket nor key match; callers compose
 * this with the API-backed strings so the lookup chain becomes:
 *
 *   backend strings -> hardcoded fallback -> caller-provided fallback -> key
 */
export function fallbackString(
    lang: SupportedLanguage,
    key: string,
): string | undefined {
    const [section, name] = key.split(".");
    if (!section || !name) return undefined;
    return FALLBACKS[lang]?.[section]?.[name];
}

export const FALLBACK_CATALOGS = FALLBACKS;
