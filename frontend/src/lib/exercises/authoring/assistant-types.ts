/**
 * #2510 — the exercise-type selection model for the book-text AI assistant.
 *
 * The assistant turns pasted text into a whole lesson. The user chooses which
 * exercise types it should produce:
 *
 *  - STANDARD types are pre-selected (matching, free_text, cloze, word_tiles,
 *    multiple_choice). Doing nothing yields today's behaviour.
 *  - EXTENSION types are opt-in (the four text-only ext:al-* types).
 *  - UNAVAILABLE types (picture_choice, image-description, dictation) cannot be
 *    generated from text alone (they need image/audio assets). They are shown
 *    greyed-out + explained, never generated, and never part of a selection.
 *
 * Pure + library-grade: the persistence helpers guard localStorage and fail
 * open (a broken/foreign value degrades to the defaults, never throws).
 */

import {
    CATEGORIZATION_EXT_TYPE,
    DICTATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    IMAGE_DESCRIPTION_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
} from "./extension-edit";

/** Standard (core, text-generatable) types, pre-selected by default. */
export const ASSISTANT_STANDARD_TYPES: readonly string[] = [
    "matching",
    "free_text",
    "cloze",
    "word_tiles",
    "multiple_choice",
];

/** The four text-only extension types the assistant can produce (opt-in). */
export const ASSISTANT_EXTENSION_TYPES: readonly string[] = [
    READING_COMPREHENSION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
];

/** Types shown greyed-out: they need assets a pasted text cannot supply, so the
 *  assistant can never generate them (add them in the editor afterwards). */
export const ASSISTANT_UNAVAILABLE_TYPES: readonly string[] = [
    "picture_choice",
    IMAGE_DESCRIPTION_EXT_TYPE,
    DICTATION_EXT_TYPE,
];

/** Every type the user may actually select (standard + extension). */
export const ASSISTANT_SELECTABLE_TYPES: readonly string[] = [
    ...ASSISTANT_STANDARD_TYPES,
    ...ASSISTANT_EXTENSION_TYPES,
];

/** The default selection: the standard types (today's behaviour). */
export const DEFAULT_ASSISTANT_TYPES: readonly string[] = [
    ...ASSISTANT_STANDARD_TYPES,
];

const SELECTABLE_SET: ReadonlySet<string> = new Set(ASSISTANT_SELECTABLE_TYPES);

/** localStorage key for the remembered selection. The ``adaptive-learner.``
 *  prefix rides the backup snapshot with the other browser-local prefs. */
export const ASSISTANT_TYPES_STORAGE_KEY = "adaptive-learner.assistant.exerciseTypes";

/**
 * Sanitize a raw selection: keep only known selectable types (order follows
 * {@link ASSISTANT_SELECTABLE_TYPES}), and fall back to the defaults when the
 * result would be empty — the min-one floor lives here so no path can persist
 * or generate an empty selection.
 */
export function sanitizeAssistantTypes(raw: readonly string[]): string[] {
    const chosen = new Set(raw.filter((t) => SELECTABLE_SET.has(t)));
    const ordered = ASSISTANT_SELECTABLE_TYPES.filter((t) => chosen.has(t));
    return ordered.length > 0 ? ordered : [...DEFAULT_ASSISTANT_TYPES];
}

/** Read the remembered selection, or the defaults when none/invalid is stored.
 *  Never throws (localStorage may be unavailable or hold a foreign value). */
export function loadAssistantTypes(): string[] {
    try {
        const raw = globalThis.localStorage?.getItem(ASSISTANT_TYPES_STORAGE_KEY);
        if (!raw) return [...DEFAULT_ASSISTANT_TYPES];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [...DEFAULT_ASSISTANT_TYPES];
        return sanitizeAssistantTypes(parsed.filter((x): x is string => typeof x === "string"));
    } catch {
        return [...DEFAULT_ASSISTANT_TYPES];
    }
}

/** Persist the selection for the next run. Sanitizes first (never stores an
 *  empty selection). Never throws. */
export function saveAssistantTypes(types: readonly string[]): void {
    try {
        const clean = sanitizeAssistantTypes(types);
        globalThis.localStorage?.setItem(
            ASSISTANT_TYPES_STORAGE_KEY,
            JSON.stringify(clean),
        );
    } catch {
        /* localStorage unavailable — a lost preference is not worth a crash. */
    }
}
