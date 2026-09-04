/**
 * ``ext:al-speak-and-record`` core (engine#68 idea 3) - a speaker button
 * reads a sentence, a "show" button reveals its text, a "record" button
 * lets the learner record themselves saying it. Mirrors the engine
 * example ``ext:ref-speak-and-record`` (engine#68, decided as an
 * extension rather than a core-schema change).
 *
 * Unlike every other adopted extension this one is deliberately
 * UNGRADED: there is nothing to check a recording against, so there is no
 * ``*PayloadErrors`` grading contract and no ``grade*``/``canonical*``
 * helper here - the renderer never derives an ``ElementAttempt``.
 *
 * Self-contained (Option A): no card reference. ``audio`` is OPTIONAL -
 * when absent the renderer falls back to on-device speech synthesis
 * (``SpeechButton``) of ``sentence``.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-speak-and-record@<major>``. */
export const SPEAK_AND_RECORD_EXT_TYPE = "ext:al-speak-and-record";

/** The ``ext_payload`` shape ``ext:al-speak-and-record`` expects. */
export interface SpeakAndRecordPayload {
    /** The sentence read aloud and revealed by the "show" button. */
    sentence: string;
    /** Optional pre-authored reference clip (relative ``assets/`` path,
     *  resolved by ``useAsset``). Absent falls back to on-device TTS. */
    audio?: string;
}

/** Read the payload, or null when it is not shaped right (``sentence``
 *  string, optional ``audio`` string). */
export function asSpeakAndRecordPayload(
    exercise: ContentLessonExercise,
): SpeakAndRecordPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.sentence !== "string") return null;
    if (payload.audio !== undefined && typeof payload.audio !== "string") return null;
    return {
        sentence: payload.sentence,
        audio: typeof payload.audio === "string" ? payload.audio : undefined,
    };
}

/** ENGINE half: validate one ``ext:al-speak-and-record`` payload. Mirrors
 *  the engine reference rules ``E-EXT-REFSPEAKRECORD-SHAPE`` /
 *  ``-SENTENCE``. Returns human-readable messages; empty when valid. */
export function speakAndRecordPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asSpeakAndRecordPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with sentence (string) and an optional audio (string)`,
        ];
    }
    if (payload.sentence.trim() === "") {
        return [`'${exercise.id}' needs a non-empty sentence`];
    }
    return [];
}
