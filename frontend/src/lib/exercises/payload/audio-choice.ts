/**
 * ``ext:al-audio-choice`` — a gapped sentence with N audio options, one of
 * which fills the gap ("listen to the words, pick the one that fits").
 * Mirrors the engine reference extension ``ext:ref-audio-choice``
 * (learn-content-engine v0.23.0): the flat core schema has no audio-option
 * choice type (``images`` is ``picture_choice``'s visual twin,
 * ``multiple_choice`` options carry text only), so this is modelled as a
 * single ext exercise whose ``ext_payload`` carries the gapped sentence plus
 * the audio options (engine#68 — an audio player is a consumer capability,
 * not a core field).
 *
 * Self-contained (Option A): no card reference. No ``label`` field on an
 * option by design — a visible word next to its audio would spoil a
 * listening exercise, mirroring ``ext:al-image-description``'s omission of
 * alt-text.
 *
 * This module is the ENGINE half (payload validation) plus pure helpers —
 * no React, no audio player. The renderer plays each option's clip via the
 * shared asset-resolution chain and grades by comparing the selected
 * option's ``audio`` reference against {@link correctAudioChoiceOption}.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-audio-choice@<major>``. */
export const AUDIO_CHOICE_EXT_TYPE = "ext:al-audio-choice";

/** One audio option in an ``ext:al-audio-choice`` payload. */
export interface AudioChoiceOption {
    /** Relative ``assets/`` path or embedded ``data:audio/…`` URI. */
    audio: string;
    is_correct?: "true";
}

/** The ``ext_payload`` shape ``ext:al-audio-choice`` expects. */
export interface AudioChoicePayload {
    /** The gapped sentence shown as text, containing the marker ``___``. */
    sentence: string;
    /** At least 2 audio options; exactly one carries ``is_correct: "true"``. */
    options: AudioChoiceOption[];
}

function asAudioChoiceOption(value: unknown): AudioChoiceOption | null {
    if (typeof value !== "object" || value === null) return null;
    const candidate = value as {audio?: unknown; is_correct?: unknown};
    if (typeof candidate.audio !== "string") return null;
    if (candidate.is_correct !== undefined && candidate.is_correct !== "true") return null;
    return {
        audio: candidate.audio,
        is_correct: candidate.is_correct as "true" | undefined,
    };
}

/** Read the payload, or null when it is not shaped right (``sentence``
 *  string + at least 2 options each ``{audio: string, is_correct?: "true"}``). */
export function asAudioChoicePayload(
    exercise: ContentLessonExercise,
): AudioChoicePayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.sentence !== "string") return null;
    const rawOptions = payload.options;
    if (!Array.isArray(rawOptions) || rawOptions.length < 2) return null;
    const options = rawOptions.map(asAudioChoiceOption);
    if (options.some((option) => option === null)) return null;
    return {sentence: payload.sentence, options: options as AudioChoiceOption[]};
}

/** ENGINE half: validate one ``ext:al-audio-choice`` payload. Mirrors the
 *  engine reference rules ``E-EXT-REFAUDIOCHOICE-SHAPE`` / ``-SENTENCE`` /
 *  ``-AUDIO`` / ``-CORRECT``. Returns human-readable messages; empty when
 *  valid. */
export function audioChoicePayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asAudioChoicePayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with sentence (string) and at least 2 options ({audio: string, is_correct?: 'true'})`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.sentence.trim() === "" || !payload.sentence.includes("___")) {
        payloadErrors.push(
            `'${exercise.id}' needs a non-empty sentence containing the gap marker '___'`,
        );
    }
    if (payload.options.some((option) => option.audio.trim() === "")) {
        payloadErrors.push(`'${exercise.id}' needs every option's audio to be non-empty`);
    }
    const correctCount = payload.options.filter(
        (option) => option.is_correct === "true",
    ).length;
    if (correctCount !== 1) {
        payloadErrors.push(
            `'${exercise.id}' needs exactly one option marked is_correct: 'true'`,
        );
    }
    return payloadErrors;
}

/** The audio reference of the single ``is_correct: "true"`` option — the SRS
 *  element key and the value graded against. Empty string when the payload
 *  is malformed or does not carry exactly one correct option. */
export function correctAudioChoiceOption(
    exercise: ContentLessonExercise,
): string {
    const payload = asAudioChoicePayload(exercise);
    if (!payload) return "";
    const correct = payload.options.filter((option) => option.is_correct === "true");
    return correct.length === 1 ? correct[0]!.audio : "";
}
