/**
 * ``ext:al-audio-tiles`` — a spoken source-language sentence, built up as a
 * target-language translation from word tiles ("listen to the sentence,
 * arrange the translation from tiles"). Mirrors the engine reference
 * extension ``ext:ref-audio-tiles`` (learn-content-engine v0.23.0): core
 * ``word_tiles`` already covers the puzzle mechanic (``tiles`` +
 * ``accept_orderings``) but carries no audio and no source-language
 * sentence, so this bundles audio + tiles into ONE self-contained
 * ``ext_payload`` (engine#68) rather than pairing a core ``word_tiles``
 * exercise with a bare ``ext_payload.audio``.
 *
 * Self-contained (Option A): no card reference. No ``direction`` field — the
 * payload is already direction-specific by construction (``audio`` = source
 * language, ``tiles`` = target language).
 *
 * This module is the ENGINE half (payload validation) plus a pure
 * permutation check — no React, no drag-and-drop. The renderer reuses the
 * app's existing word-tiles editor/DnD machinery, fed from this payload
 * instead of the core ``exercise.tiles`` field.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-audio-tiles@<major>``. */
export const AUDIO_TILES_EXT_TYPE = "ext:al-audio-tiles";

/** The ``ext_payload`` shape ``ext:al-audio-tiles`` expects. */
export interface AudioTilesPayload {
    /** Relative ``assets/`` path or embedded ``data:audio/…`` URI of the
     *  source-language sentence. */
    audio: string;
    /** Target-language words to arrange, in canonical order. */
    tiles: string[];
    /** Alternative accepted orderings, each a permutation of
     *  ``[0..tiles.length - 1]``. Omitted = only the canonical order. */
    accept_orderings?: number[][];
}

/** Whether ``ordering`` is a permutation of ``[0..tileCount - 1]``. */
function isPermutation(ordering: number[], tileCount: number): boolean {
    const expected = Array.from({length: tileCount}, (_unused, index) => index);
    const sorted = [...ordering].sort((a, b) => a - b);
    return (
        sorted.length === expected.length &&
        sorted.every((value, index) => value === expected[index])
    );
}

/** Read the payload, or null when it is not shaped right (``audio`` string +
 *  ``tiles`` string[], with an optional ``accept_orderings`` number[][]). */
export function asAudioTilesPayload(
    exercise: ContentLessonExercise,
): AudioTilesPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.audio !== "string") return null;
    const rawTiles = payload.tiles;
    if (!Array.isArray(rawTiles) || !rawTiles.every((tile) => typeof tile === "string")) {
        return null;
    }
    const rawOrderings = payload.accept_orderings;
    if (rawOrderings !== undefined) {
        if (
            !Array.isArray(rawOrderings) ||
            !rawOrderings.every(
                (ordering) =>
                    Array.isArray(ordering) &&
                    ordering.every((index) => typeof index === "number"),
            )
        ) {
            return null;
        }
    }
    return {
        audio: payload.audio,
        tiles: rawTiles as string[],
        accept_orderings: rawOrderings as number[][] | undefined,
    };
}

/** ENGINE half: validate one ``ext:al-audio-tiles`` payload. Mirrors the
 *  engine reference rules ``E-EXT-REFAUDIOTILES-SHAPE`` / ``-AUDIO`` /
 *  ``-TILES`` / ``-ORDERINGS``. Returns human-readable messages; empty when
 *  valid. */
export function audioTilesPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asAudioTilesPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with audio (string) and tiles (string[])`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.audio.trim() === "") {
        payloadErrors.push(`'${exercise.id}' needs a non-empty audio reference`);
    }
    if (payload.tiles.length < 2) {
        payloadErrors.push(`'${exercise.id}' needs at least 2 tiles`);
    }
    for (const ordering of payload.accept_orderings ?? []) {
        if (!isPermutation(ordering, payload.tiles.length)) {
            payloadErrors.push(
                `'${exercise.id}' accept_orderings entry ${JSON.stringify(ordering)} must be a permutation of [0..${payload.tiles.length - 1}]`,
            );
        }
    }
    return payloadErrors;
}
