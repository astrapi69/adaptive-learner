/**
 * UI-language metadata (EXP-027 / I18N-02 + I18N-04).
 *
 * The single source of truth for the languages the display-language
 * picker offers, with the data the searchable {@link LanguagePicker}
 * needs: native name, English name, and writing system (for the
 * grouping that kicks in once the list grows past the picker's
 * threshold).
 *
 * Adding a UI language: ship its ``backend/config/i18n/{code}.yaml``
 * catalog (mirrored to ``frontend/src/data/i18n/{code}.json``), add a
 * ``languages.{code}`` localized name to every catalog, then add a row
 * here. The picker and Settings/Landing pick it up automatically.
 */

import type {LanguagePickerOption} from "../shared/LanguagePicker";

/** Writing systems, used to group the picker once it grows large. */
export type WritingScript =
    | "latin"
    | "greek"
    | "cjk"
    | "devanagari"
    | "arabic"
    | "hangul"
    | "bengali"
    | "cyrillic";

export interface LanguageMeta {
    /** ISO 639-1 code, the value persisted as the UI language. */
    code: string;
    /** Endonym — the language's name in its own script. */
    nativeName: string;
    /** English name; the i18n fallback for the localized label. */
    englishName: string;
    /** Writing system, for script-based grouping. */
    script: WritingScript;
}

/**
 * The UI languages with a shipped catalog (``frontend/src/data/i18n``).
 * Ordered by rough speaker reach so the flat (ungrouped) list leads
 * with the highest-reach options.
 */
export const UI_LANGUAGES: LanguageMeta[] = [
    {code: "en", nativeName: "English", englishName: "English", script: "latin"},
    {code: "es", nativeName: "Español", englishName: "Spanish", script: "latin"},
    {code: "fr", nativeName: "Français", englishName: "French", script: "latin"},
    {code: "pt", nativeName: "Português", englishName: "Portuguese", script: "latin"},
    {code: "de", nativeName: "Deutsch", englishName: "German", script: "latin"},
    {code: "tr", nativeName: "Türkçe", englishName: "Turkish", script: "latin"},
    {code: "ja", nativeName: "日本語", englishName: "Japanese", script: "cjk"},
    {code: "el", nativeName: "Ελληνικά", englishName: "Greek", script: "greek"},
    {code: "hi", nativeName: "हिन्दी", englishName: "Hindi", script: "devanagari"},
];

/** Display order of the script groups in the grouped picker. */
export const SCRIPT_ORDER: WritingScript[] = [
    "latin",
    "greek",
    "cyrillic",
    "arabic",
    "devanagari",
    "bengali",
    "cjk",
    "hangul",
];

/** Minimal ``t`` shape so this module stays free of the i18n hook type. */
type Translate = (key: string, fallback?: string) => string;

/**
 * Build {@link LanguagePicker} options from {@link UI_LANGUAGES},
 * localizing each name + script group via the supplied ``t``. Sorted
 * by script (per {@link SCRIPT_ORDER}) so the grouped view is stable.
 *
 * @example
 * const {t} = useI18n();
 * <LanguagePicker languages={buildLanguageOptions(t)} ... />
 */
export function buildLanguageOptions(t: Translate): LanguagePickerOption[] {
    const ordered = [...UI_LANGUAGES].sort(
        (a, b) =>
            SCRIPT_ORDER.indexOf(a.script) - SCRIPT_ORDER.indexOf(b.script),
    );
    return ordered.map((meta) => ({
        value: meta.code,
        nativeLabel: meta.nativeName,
        localizedLabel: t(`languages.${meta.code}`, meta.englishName),
        group: t(`languages.script.${meta.script}`, meta.script),
    }));
}
