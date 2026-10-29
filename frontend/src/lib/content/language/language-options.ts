/**
 * Shared language + CEFR-level option lists for the content
 * authoring surfaces (Save-as-Offline-Lesson modal, the standalone
 * Lesson Creator, …). Extracted in Phase 65 (EXP-021) so the
 * Lesson Creator and the save modal share one source of truth.
 *
 * Names are English labels; the BCP-47 ``code`` is what gets stored
 * on the content set.
 */

import {ENGINE_CEFR_LEVELS} from "../engine";

export interface LanguageOption {
    code: string;
    name: string;
}

export const LANGUAGE_OPTIONS: ReadonlyArray<LanguageOption> = [
    {code: "en", name: "English"},
    {code: "de", name: "German"},
    {code: "fr", name: "French"},
    {code: "es", name: "Spanish"},
    {code: "it", name: "Italian"},
    {code: "pt", name: "Portuguese"},
    {code: "el", name: "Greek"},
    {code: "tr", name: "Turkish"},
    {code: "ja", name: "Japanese"},
    {code: "zh", name: "Chinese"},
    {code: "ru", name: "Russian"},
    {code: "nl", name: "Dutch"},
    {code: "ar", name: "Arabic"},
];

/** The CEFR bands a language set can declare: the engine's list (#3399),
 *  re-exported under the name the level selects import. */
export const CEFR_LEVELS: readonly string[] = ENGINE_CEFR_LEVELS;
