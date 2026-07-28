/**
 * ``ext:al-image-description`` core (#2095, sixth adoption) — an image stimulus
 * bound to a typed free-text answer ("look, then describe what you see"). The
 * flat core schema has no image-stimulus typed-answer type, so it is modelled
 * as a single ext exercise whose ``ext_payload`` carries the image reference
 * plus the accepted answers, mirroring the engine example
 * ``ext:ref-image-description`` (learn-content-engine v0.15.0, PR #89 — decided
 * as an extension, NOT a core-schema change; ``ext_payload`` stays opaque so no
 * ``schema/*.json`` edit is needed, exactly like ``ext:al-dictation``).
 *
 * Self-contained (Option A): no card reference — everything the consumer needs
 * is in ``ext_payload`` (``image`` = an embedded ``data:image/…;base64,…`` URI
 * or a relative ``assets/`` path; ``accept`` = the tolerated answers). Offline
 * is non-negotiable, so a remote ``http(s)://`` image is rejected at validation
 * time (it would blank the exercise with no network and carry no bytes in the
 * ``.alb`` backup — see the offline-first rule in architecture.md).
 *
 * This module is the ENGINE half (payload validation) plus pure helpers — no
 * React, no image element, no matcher import. The renderer displays the image
 * and grades with the shared ``isFreeTextCorrect`` matcher.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-image-description@<major>``. */
export const IMAGE_DESCRIPTION_EXT_TYPE = "ext:al-image-description";

/** The ``ext_payload`` shape ``ext:al-image-description`` expects. */
export interface ImageDescriptionPayload {
    /** Embedded ``data:image/…;base64,…`` URI (preferred, offline) or a
     *  relative ``assets/`` path (resolved by ``useAsset``). */
    image: string;
    /** Accepted answers (tolerant free-text match; ``accept[0]`` is the
     *  canonical answer surfaced after a wrong attempt). */
    accept: string[];
}

/** Whether an image reference is a remote URL. Remote media breaks the
 *  offline-first guarantee, so it is not a supported image form. */
export function isRemoteImageUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
}

/** Read the payload, or null when it is not shaped right (``image`` string +
 *  ``accept`` string array). */
export function asImageDescriptionPayload(
    exercise: ContentLessonExercise,
): ImageDescriptionPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.image !== "string") return null;
    if (
        !Array.isArray(payload.accept) ||
        !payload.accept.every((entry) => typeof entry === "string")
    ) {
        return null;
    }
    return {image: payload.image, accept: payload.accept as string[]};
}

/** ENGINE half: validate one ``ext:al-image-description`` payload. Mirrors the
 *  engine reference rules ``E-EXT-REFIMG-SHAPE`` / ``-SRC`` / ``-ACCEPT`` and
 *  adds the app-side offline-first constraint (no remote image URL). Returns
 *  human-readable messages; empty when valid. */
export function imageDescriptionPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asImageDescriptionPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with image (string) and accept (string[])`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.image.trim() === "") {
        payloadErrors.push(`'${exercise.id}' needs a non-empty image reference`);
    } else if (isRemoteImageUrl(payload.image)) {
        payloadErrors.push(
            `'${exercise.id}' image must be an embedded data URI or an assets/ path, not a remote URL (offline-first)`,
        );
    }
    if (payload.accept.filter((entry) => entry.trim() !== "").length === 0) {
        payloadErrors.push(
            `'${exercise.id}' needs at least 1 non-empty accept entry`,
        );
    }
    return payloadErrors;
}

/** The canonical answer (first non-empty ``accept`` entry) — the SRS element
 *  key and the after-wrong-attempt solution. Empty string when the payload
 *  carries none. */
export function canonicalImageDescriptionAnswer(
    exercise: ContentLessonExercise,
): string {
    const payload = asImageDescriptionPayload(exercise);
    return payload?.accept.find((entry) => entry.trim() !== "") ?? "";
}
