/**
 * Client-side dictation-audio processing (#1911, ext:al-dictation Slice 3).
 *
 * Turns a user-selected audio file into a self-contained base64 data URI
 * suitable for storing directly in an ``ext:al-dictation`` exercise's
 * ``ext_payload.audio`` field. Everything runs in the browser — no upload, no
 * server, no new storage — mirroring the card-image pipeline ({@link
 * processCardImageFile}), which stores a data URI in the card's ``image``
 * field.
 *
 * Unlike an image there is no re-encode step (audio can't be canvas-
 * recompressed), so processing is only a format + size gate followed by a
 * ``FileReader`` read. A short dictation clip stays small; the {@link
 * AUDIO_MAX_BYTES} cap keeps a set's total well under the import size limit
 * and the Dexie/IndexedDB storage budget while still allowing a
 * spoken-sentence clip.
 *
 * The ``ext_payload`` is an opaque, open object in the lesson JSON-Schema
 * (``additionalProperties: true`` with no pattern on ``audio``) and the
 * app-side ``dictationPayloadErrors`` only requires a non-empty string, so a
 * data URI is fully schema-valid there — no engine-schema change is needed
 * (the ``picture_choice`` data-URI adoption DID need one because
 * ``images[].src`` is a strictly-typed core field).
 */

import {isDataUri} from "./card-image";

/** Maximum accepted raw audio-file size. A data URI is ~1.33x larger, so a
 *  2 MiB clip becomes ~2.7 MiB of base64 — comfortably within the import +
 *  IndexedDB budget while allowing a multi-second spoken sentence. */
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024;

/** Accepted audio MIME types: MP3, OGG, WAV (and their common variants). */
export const ACCEPTED_AUDIO_TYPES = [
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
];

/** Accepted file extensions, used to gate files whose browser MIME type is
 *  empty (common for ``.wav`` on some platforms) and to build the ``accept``
 *  attribute of the file input. */
export const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".ogg", ".wav"];

/** The ``accept`` attribute for the audio ``<input type="file">``: MIME types
 *  plus extensions, so pickers on every platform offer the right files. */
export const AUDIO_ACCEPT_ATTR = [
    ...ACCEPTED_AUDIO_TYPES,
    ...ACCEPTED_AUDIO_EXTENSIONS,
].join(",");

/** i18n keys thrown by {@link processAudioFile} on failure. */
export const DICT_AUDIO_ERROR_UNSUPPORTED =
    "create_lesson.extensions.edit.dict_audio_error.unsupported_type";
export const DICT_AUDIO_ERROR_TOO_LARGE =
    "create_lesson.extensions.edit.dict_audio_error.too_large";
export const DICT_AUDIO_ERROR_DECODE =
    "create_lesson.extensions.edit.dict_audio_error.decode_failed";

/** Whether a MIME type is an accepted audio format. */
export function isAcceptedAudioType(type: string): boolean {
    return ACCEPTED_AUDIO_TYPES.includes(type.toLowerCase());
}

/** Whether a filename carries an accepted audio extension. Used as the
 *  fallback when the browser reports an empty MIME type. */
export function hasAcceptedAudioExtension(name: string): boolean {
    const lower = name.toLowerCase();
    return ACCEPTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Whether a file is an accepted audio upload — by MIME type, or by
 *  extension when the MIME type is missing/blank. */
export function isAcceptedAudioFile(file: File): boolean {
    if (file.type) return isAcceptedAudioType(file.type);
    return hasAcceptedAudioExtension(file.name);
}

/** Re-exported so the field component can branch on data-URI vs path without a
 *  second predicate. */
export {isDataUri};

/**
 * Process a user-selected file into a stored-ready audio data URI.
 *
 * @throws Error with a stable, translatable reason key on an unsupported
 *   type, a file over the size cap, or an unreadable file.
 */
export async function processAudioFile(file: File): Promise<string> {
    if (!isAcceptedAudioFile(file)) {
        throw new Error(DICT_AUDIO_ERROR_UNSUPPORTED);
    }
    if (file.size > AUDIO_MAX_BYTES) {
        throw new Error(DICT_AUDIO_ERROR_TOO_LARGE);
    }
    return readFileAsDataUrl(file);
}

/** Read a file to a base64 data URL, rejecting with the decode error key on
 *  any reader failure. */
function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string" && result.startsWith("data:")) {
                resolve(result);
            } else {
                reject(new Error(DICT_AUDIO_ERROR_DECODE));
            }
        };
        reader.onerror = () => reject(new Error(DICT_AUDIO_ERROR_DECODE));
        reader.readAsDataURL(file);
    });
}
