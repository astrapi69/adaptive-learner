/**
 * ``ext:al-dictation`` core (#1881, fifth adoption) — an audio stimulus bound
 * to a typed transcription ("listen, then write what you hear"). The flat core
 * schema has no audio-stimulus type and ``free_text`` carries no media, so it
 * is modelled as a single ext exercise whose ``ext_payload`` carries the audio
 * reference plus the accepted transcriptions, mirroring the engine example
 * ``ext:ref-dictation`` (engine#68, decided as an extension rather than a
 * core-schema change).
 *
 * Self-contained (Option A): no card reference — everything the consumer needs
 * is in ``ext_payload`` (``audio`` = a relative ``assets/`` path; ``accept`` =
 * the tolerated transcriptions). This module is the ENGINE half (payload
 * validation) plus pure helpers — no React, no audio player, no matcher import.
 * The renderer plays the clip via the shared ``ListenFirstAudio`` and grades
 * with the shared ``isFreeTextCorrect`` matcher.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-dictation@<major>``. */
export const DICTATION_EXT_TYPE = "ext:al-dictation";

/** The ``ext_payload`` shape ``ext:al-dictation`` expects. */
export interface DictationPayload {
    /** Relative ``assets/`` path of the audio clip (resolved by ``useAsset``). */
    audio: string;
    /** Accepted transcriptions (tolerant free-text match; ``accept[0]`` is the
     *  canonical answer surfaced after a wrong attempt). */
    accept: string[];
}

/** Read the payload, or null when it is not shaped right (``audio`` string +
 *  ``accept`` string array). */
export function asDictationPayload(
    exercise: ContentLessonExercise,
): DictationPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.audio !== "string") return null;
    if (
        !Array.isArray(payload.accept) ||
        !payload.accept.every((entry) => typeof entry === "string")
    ) {
        return null;
    }
    return {audio: payload.audio, accept: payload.accept as string[]};
}

/** ENGINE half: validate one ``ext:al-dictation`` payload. Mirrors the engine
 *  reference rules ``E-EXT-REFDICT-SHAPE`` / ``-AUDIO`` / ``-ACCEPT``. Returns
 *  human-readable messages; empty when valid. */
export function dictationPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asDictationPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with audio (string) and accept (string[])`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.audio.trim() === "") {
        payloadErrors.push(`'${exercise.id}' needs a non-empty audio reference`);
    }
    if (payload.accept.filter((entry) => entry.trim() !== "").length === 0) {
        payloadErrors.push(
            `'${exercise.id}' needs at least 1 non-empty accept entry`,
        );
    }
    return payloadErrors;
}

/** The canonical transcription (``accept[0]``, trimmed of surrounding blanks
 *  only via the matcher) — the SRS element key and the after-wrong-attempt
 *  solution. Empty string when the payload carries none. */
export function canonicalDictationAnswer(
    exercise: ContentLessonExercise,
): string {
    const payload = asDictationPayload(exercise);
    return payload?.accept.find((entry) => entry.trim() !== "") ?? "";
}
