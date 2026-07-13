/**
 * ``ext:al-error-correction`` core (#1579, second adoption) - "one token in
 * this sentence is wrong: mark it and correct it" (schema 1.7 extension
 * tier).
 *
 * The payload contract mirrors the engine's worked example
 * ``ext:ref-error-correction`` AFTER its accept-array redesign (engine PR
 * #42): ``tokens`` (the sentence), ``error_index`` (the wrong token,
 * 0-based) and ``accept`` as a string ARRAY - the core ``free_text``
 * contract, because real sentences often allow more than one defensible fix
 * for the same wrong token and a single authored string would reproduce the
 * too-narrow-accept-list false negatives (#1580). ``accept[0]`` is the
 * canonical correction surfaced after a wrong attempt.
 *
 * This module is the ENGINE half (payload validation) plus pure helpers.
 * The typed correction is graded by the RENDERER via the shared free-text
 * matcher (``isFreeTextCorrect``), so it inherits the #1580 normalization
 * and typo tolerance instead of duplicating grading logic.
 */

import type {ContentLessonExercise} from "../../storage/types";

/** The adopted extension type; declared by lessons as
 *  ``ext:al-error-correction@<major>``. */
export const ERROR_CORRECTION_EXT_TYPE = "ext:al-error-correction";

/** The ``ext_payload`` shape ``ext:al-error-correction`` expects. */
export interface ErrorCorrectionPayload {
    tokens: string[];
    error_index: number;
    accept: string[];
}

/** Read the payload as an ErrorCorrectionPayload, or null when it is not
 *  shaped right. */
export function asErrorCorrectionPayload(
    exercise: ContentLessonExercise,
): ErrorCorrectionPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    const {tokens, error_index, accept} = payload;
    if (
        !Array.isArray(tokens) ||
        !tokens.every((token) => typeof token === "string")
    ) {
        return null;
    }
    if (typeof error_index !== "number") return null;
    if (
        !Array.isArray(accept) ||
        !accept.every((entry) => typeof entry === "string")
    ) {
        return null;
    }
    return {
        tokens: tokens as string[],
        error_index,
        accept: accept as string[],
    };
}

/** ENGINE half: validate one ``ext:al-error-correction`` exercise's
 *  payload. Returns human-readable error messages; empty when valid.
 *  Mirrors the rule set of the engine's ``ext:ref-error-correction``. */
export function errorCorrectionPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asErrorCorrectionPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with tokens (string array), error_index (number), accept (string array)`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.tokens.length < 2) {
        payloadErrors.push(`'${exercise.id}' needs at least 2 tokens`);
    }
    if (payload.tokens.some((token) => token.trim() === "")) {
        payloadErrors.push(`'${exercise.id}' tokens must be non-empty`);
    }
    const indexInRange =
        Number.isInteger(payload.error_index) &&
        payload.error_index >= 0 &&
        payload.error_index < payload.tokens.length;
    if (!indexInRange) {
        payloadErrors.push(
            `'${exercise.id}' error_index must be an integer inside the token range`,
        );
    }
    if (
        payload.accept.length === 0 ||
        payload.accept.some((entry) => entry.trim() === "")
    ) {
        payloadErrors.push(
            `'${exercise.id}' accept needs at least 1 non-empty correction`,
        );
    } else if (
        indexInRange &&
        payload.accept.includes(payload.tokens[payload.error_index]!)
    ) {
        payloadErrors.push(
            `'${exercise.id}' accept entries must differ from the marked token`,
        );
    }
    return payloadErrors;
}

/** The canonical correction (``accept[0]``) surfaced after a wrong attempt -
 *  the same first-entry-is-canonical contract as core ``free_text`` and the
 *  categorization verdict chips. Null for malformed payloads. */
export function canonicalErrorCorrection(
    exercise: ContentLessonExercise,
): string | null {
    const payload = asErrorCorrectionPayload(exercise);
    return payload ? (payload.accept[0] ?? null) : null;
}
