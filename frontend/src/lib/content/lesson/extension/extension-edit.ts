/**
 * Blank-exercise factory + validation for the extension-authoring wizard
 * (#1852). Editors 1+2: ``ext:al-categorization`` + ``ext:al-error-correction``.
 *
 * Validation REUSES the shipped per-type payload validators
 * (``categorizationPayloadErrors`` / ``errorCorrectionPayloadErrors``) — the
 * exact rules the renderers + load guard already enforce — rather than
 * re-implementing them. The blank starts are deliberately invalid so the
 * wizard gate keeps a half-filled extension exercise out of the review step
 * until the author completes it.
 */

import {
    CATEGORIZATION_EXT_TYPE,
    categorizationPayloadErrors,
} from "../../../exercises/categorization";
import {
    ERROR_CORRECTION_EXT_TYPE,
    errorCorrectionPayloadErrors,
} from "../../../exercises/error-correction";
import type {ContentLessonExercise} from "../../../../storage/types";

export {CATEGORIZATION_EXT_TYPE, ERROR_CORRECTION_EXT_TYPE};

/** The extension exercise types the wizard can author today (editors 1+2).
 *  Reading-comprehension + graded-quiz follow in #1852. */
export const EXTENSION_WIZARD_TYPES = [
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
] as const;

export type ExtensionWizardType = (typeof EXTENSION_WIZARD_TYPES)[number];

const ERR = "create_lesson.extensions.edit.err_";

export interface ExtensionEditIssue {
    valid: boolean;
    errorKey: string | null;
}

const ok: ExtensionEditIssue = {valid: true, errorKey: null};

function fail(suffix: string): ExtensionEditIssue {
    return {valid: false, errorKey: `${ERR}${suffix}`};
}

let _extSeq = 0;

/** Unique id for a wizard-authored extension exercise. */
export function newExtensionExerciseId(): string {
    _extSeq += 1;
    return `ex-ext-${_extSeq}`;
}

/**
 * Build an EMPTY extension exercise of ``extType`` (deliberately invalid
 * until filled). Same ``ContentLessonExercise`` shape a real one has: the
 * type-specific data lives under ``ext_payload``.
 */
export function createBlankExtensionExercise(
    extType: ExtensionWizardType,
    id: string,
): ContentLessonExercise {
    const base = {id, prompt: "", card_ids: [], distractors: []};
    if (extType === CATEGORIZATION_EXT_TYPE) {
        return {
            ...base,
            type: extType,
            ext_payload: {
                categories: [
                    {name: "", items: []},
                    {name: "", items: []},
                ],
            },
        } as ContentLessonExercise;
    }
    return {
        ...base,
        type: extType,
        ext_payload: {tokens: ["", ""], error_index: 0, accept: []},
    } as ContentLessonExercise;
}

/**
 * Validate an extension exercise draft for the inline editor. Checks the
 * common prompt, then delegates to the shipped payload validator. Returns
 * the first failure (as an i18n key) or ``{valid: true}``.
 */
export function validateExtensionExercise(
    ex: ContentLessonExercise,
): ExtensionEditIssue {
    if (ex.prompt.trim().length < 1) return fail("prompt");
    if (ex.type === CATEGORIZATION_EXT_TYPE) {
        // The shipped payload validator does not require a non-empty category
        // name (uniqueness is enough for the load guard). The authoring wizard
        // does: an unnamed bucket renders as a blank label, so require every
        // category to be named on top of the shipped rules.
        const named = categorizationCategories(ex).every(
            (bucket) => bucket.name.trim().length > 0,
        );
        return categorizationPayloadErrors(ex).length === 0 && named
            ? ok
            : fail("categorization");
    }
    if (ex.type === ERROR_CORRECTION_EXT_TYPE) {
        return errorCorrectionPayloadErrors(ex).length === 0
            ? ok
            : fail("error_correction");
    }
    // A type without a wizard editor is never blocked here.
    return ok;
}

function trimmedNonEmpty(values: string[] | undefined): string[] {
    return (values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
}

function categorizationCategories(
    ex: ContentLessonExercise,
): {name: string; items: string[]}[] {
    const payload = ex.ext_payload as
        | {categories?: {name: string; items: string[]}[]}
        | undefined;
    return payload?.categories ?? [];
}

/**
 * Normalize a validated extension draft before it is committed: trim the
 * prompt and the payload strings, drop empty categories/items/accepts.
 * ``error_correction`` tokens are POSITIONAL (``error_index`` points into
 * them), so they are trimmed in place, never dropped.
 */
export function normalizeExtensionExercise(
    ex: ContentLessonExercise,
): ContentLessonExercise {
    const prompt = ex.prompt.trim();
    if (ex.type === CATEGORIZATION_EXT_TYPE) {
        const payload = ex.ext_payload as
            | {categories?: {name: string; items: string[]}[]}
            | undefined;
        const categories = (payload?.categories ?? [])
            .map((c) => ({
                name: c.name.trim(),
                items: trimmedNonEmpty(c.items),
            }))
            .filter((c) => c.name.length > 0 && c.items.length > 0);
        return {...ex, prompt, ext_payload: {categories}} as ContentLessonExercise;
    }
    if (ex.type === ERROR_CORRECTION_EXT_TYPE) {
        const payload = ex.ext_payload as
            | {tokens?: string[]; error_index?: number; accept?: string[]}
            | undefined;
        const tokens = (payload?.tokens ?? []).map((t) => t.trim());
        const rawIndex = payload?.error_index ?? 0;
        const error_index = Math.min(
            Math.max(0, Math.trunc(rawIndex)),
            Math.max(0, tokens.length - 1),
        );
        return {
            ...ex,
            prompt,
            ext_payload: {
                tokens,
                error_index,
                accept: trimmedNonEmpty(payload?.accept),
            },
        } as ContentLessonExercise;
    }
    return {...ex, prompt};
}
