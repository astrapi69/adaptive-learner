/**
 * i18next engine (#2797) — the string-resolution layer the app used to hand-roll.
 *
 * The previous implementation walked the catalog itself, kept its own cache and
 * its own fallback chain. That hand-rolled lookup carried the #2796 defect: it
 * destructured a key into exactly two parts, so every deeper key
 * (``update.banner.message``) was structurally unreachable. A library that has
 * done key resolution for a decade does not have that class of bug.
 *
 * What i18next owns here: arbitrary-depth key paths, the per-language fallback
 * chain, merging a lazily arriving catalog over the preloaded one, and
 * re-rendering consumers when either the language or the resources change.
 *
 * What stays ours (deliberately): WHICH strings are preloaded for the first
 * paint (``FALLBACK_CATALOGS``, kept complete for the shell by
 * ``first-paint-coverage.test.ts``), and where the full catalog comes from
 * (``getStorage().i18n.get`` — the backend in API mode, the bundled chunk in
 * Dexie mode).
 *
 * Interpolation is OFF: the app's placeholders are single-brace (``{version}``)
 * and every call site substitutes them with ``String.replace``. i18next's
 * default double-brace syntax therefore never matches, and the 2326 existing
 * call sites keep working unchanged.
 */

import i18next, {type i18n as I18nInstance} from "i18next";
import {initReactI18next} from "react-i18next";

import {FALLBACK_CATALOGS} from "./fallbacks";

/** The single i18next namespace the app uses (no per-page namespaces). */
export const NAMESPACE = "translation";

/** Preloaded first-paint resources, keyed by language. */
function initialResources(): Record<string, Record<string, object>> {
    const resources: Record<string, Record<string, object>> = {};
    for (const [lang, catalog] of Object.entries(FALLBACK_CATALOGS)) {
        resources[lang] = {[NAMESPACE]: catalog as object};
    }
    return resources;
}

let instance: I18nInstance | null = null;

/**
 * The configured i18next instance, created once per process.
 *
 * @example
 * getI18n().t("update.banner.later"); // resolves the full dot path
 */
export function getI18n(): I18nInstance {
    if (instance) return instance;
    const created = i18next.createInstance();
    void created.use(initReactI18next).init({
        lng: "de",
        fallbackLng: "en",
        defaultNS: NAMESPACE,
        ns: [NAMESPACE],
        resources: initialResources(),
        // Single-brace placeholders are substituted by the call sites, so
        // i18next must not try to interpolate them (its syntax is {{...}}).
        interpolation: {escapeValue: false},
        // A missing key must never surface as an object or null.
        returnNull: false,
        returnObjects: false,
        // No Suspense: the shell renders immediately from the preloaded
        // resources and upgrades in place when the full catalog lands.
        react: {useSuspense: false, bindI18nStore: "added"},
        // The capability the hand-rolled layer never had: a key that resolves
        // nowhere is reported instead of silently becoming an English literal.
        // Dev-only - production users must never see console noise, and the
        // handler must never throw into a render.
        saveMissing: import.meta.env.DEV,
        missingKeyHandler: (languages, _ns, key) => {
            if (!import.meta.env.DEV) return;
            console.warn(
                `[i18n] missing key "${key}" for ${languages.join(", ")} - ` +
                    "add it to the YAML catalogs (and, if the shell renders it " +
                    "before the catalog loads, to the first-paint fallbacks).",
            );
        },
    });
    instance = created;
    return created;
}

/**
 * Merge a freshly loaded catalog over the preloaded first-paint strings.
 * Deep merge + overwrite: the full catalog wins wherever both define a key.
 */
export function addCatalog(lang: string, catalog: object): void {
    getI18n().addResourceBundle(lang, NAMESPACE, catalog, true, true);
}

/** TEST-ONLY seam: drop the instance so a test can start from a clean engine. */
export function _resetEngineForTests(): void {
    instance = null;
}
