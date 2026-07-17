/**
 * Client-side card-image processing (#1763).
 *
 * Turns a user-selected image file into a small, self-contained base64
 * data URL suitable for storing directly in a lesson card's ``image``
 * field. Everything runs in the browser — no upload, no server, no new
 * storage. The card ``image`` schema field is an unbounded string, so a
 * data URI is schema-valid there and survives the verbatim lesson
 * export/import round-trip unchanged (#1672).
 *
 * The image is downscaled (aspect-preserving) to at most
 * {@link CARD_IMAGE_MAX_DIMENSION}px on its longest edge and JPEG-encoded;
 * if it still exceeds {@link CARD_IMAGE_MAX_BYTES} the quality is stepped
 * down until it fits (or the file is rejected). This bounds the base64
 * bloat so a set with several images stays well under the import size cap.
 *
 * The canvas encode mirrors the avatar ``resize-image`` pipeline; the
 * shared {@link dataUrlByteLength} helper is reused from there.
 */

import {dataUrlByteLength} from "../../avatar/resize-image";

export const CARD_IMAGE_MAX_DIMENSION = 512;
export const CARD_IMAGE_MAX_BYTES = 150 * 1024;
export const ACCEPTED_CARD_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

/** i18n keys thrown by {@link processCardImageFile} on failure. */
export const CARD_IMAGE_ERROR_UNSUPPORTED =
    "create_lesson.cards.image_error.unsupported_type";
export const CARD_IMAGE_ERROR_TOO_LARGE =
    "create_lesson.cards.image_error.too_large";
export const CARD_IMAGE_ERROR_DECODE =
    "create_lesson.cards.image_error.decode_failed";

/** Whether a card-image reference is an embedded data URI (vs a path). */
export function isDataUri(value: string): boolean {
    return value.trim().startsWith("data:");
}

/** Whether a MIME type is an accepted card-image format. */
export function isAcceptedCardImageType(type: string): boolean {
    return ACCEPTED_CARD_IMAGE_TYPES.includes(type);
}

/**
 * Aspect-preserving target dimensions: downscale so the longest edge is
 * at most ``max``; leave already-small images untouched. A degenerate
 * (zero-sided) source returns a zero box.
 */
export function scaledDimensions(
    width: number,
    height: number,
    max: number,
): {width: number; height: number} {
    if (width <= 0 || height <= 0) return {width: 0, height: 0};
    const longest = Math.max(width, height);
    if (longest <= max) return {width, height};
    const ratio = max / longest;
    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
    };
}

/**
 * Draw the downscaled image onto a canvas and return the JPEG data URL,
 * stepping quality down until it fits the byte cap (or ``null`` if it
 * cannot). Exported with an injectable ``makeCanvas`` seam so the encode
 * path is unit-testable without a real 2D context.
 */
export function encodeCardImage(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    makeCanvas: (w: number, h: number) => HTMLCanvasElement = defaultCanvas,
): string | null {
    const {width, height} = scaledDimensions(
        sourceWidth,
        sourceHeight,
        CARD_IMAGE_MAX_DIMENSION,
    );
    if (width === 0 || height === 0) return null;
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrlByteLength(dataUrl) <= CARD_IMAGE_MAX_BYTES) return dataUrl;
    }
    return null;
}

function defaultCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/**
 * Process a user-selected file into a stored-ready card-image data URL.
 *
 * @throws Error with a stable, translatable reason key on an unsupported
 *   type, an undecodable file, or an image that won't shrink under the
 *   size cap.
 */
export async function processCardImageFile(file: File): Promise<string> {
    if (!isAcceptedCardImageType(file.type)) {
        throw new Error(CARD_IMAGE_ERROR_UNSUPPORTED);
    }
    const objectUrl = URL.createObjectURL(file);
    try {
        const img = await loadImage(objectUrl);
        const dataUrl = encodeCardImage(
            img,
            img.naturalWidth,
            img.naturalHeight,
        );
        if (!dataUrl) throw new Error(CARD_IMAGE_ERROR_TOO_LARGE);
        return dataUrl;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(CARD_IMAGE_ERROR_DECODE));
        img.src = url;
    });
}
