/**
 * ``ext:al-hotspot`` core (#3110) — an image with clickable zones: tap the
 * right spot. Mirrors the engine reference extension ``ext:ref-hotspot``
 * (engine#149), adopted here under the app's vendor namespace, sibling of
 * ``ext:al-parsons`` (the pair share engine#149).
 *
 * Self-contained (Option A, like dictation/image-description): no card
 * reference — everything the consumer needs is in ``ext_payload``. Zone
 * coordinates are PERCENTAGES (0-100) of the rendered image, so the
 * renderer's SVG overlay scales with the image regardless of its natural
 * or displayed pixel size — no separate "reported image dimensions" state
 * to keep in sync.
 *
 * This module is the ENGINE half (payload validation) plus the pure
 * hit-test — no React, no image loading.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-hotspot@<major>``. */
export const HOTSPOT_EXT_TYPE = "ext:al-hotspot";

export interface HotspotRectZone {
    shape: "rect";
    /** Percentages (0-100) of the rendered image. */
    coords: {x: number; y: number; width: number; height: number};
    /** ``"true"`` marks the single correct zone; absent = distractor.
     *  A string flag (not boolean), matching the schema's existing
     *  ``is_correct`` convention (picture_choice, categorization). */
    is_correct?: "true";
}

export interface HotspotCircleZone {
    shape: "circle";
    /** Percentages (0-100) of the rendered image. */
    coords: {cx: number; cy: number; radius: number};
    is_correct?: "true";
}

export type HotspotZone = HotspotRectZone | HotspotCircleZone;

/** The ``ext_payload`` shape ``ext:al-hotspot`` expects. */
export interface HotspotPayload {
    /** Relative ``assets/`` path of the image (resolved by ``useAsset``). */
    src: string;
    /** The clickable zones (>= 2, exactly one correct). */
    zones: HotspotZone[];
}

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

function isPercent(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= PERCENT_MIN &&
        value <= PERCENT_MAX
    );
}

function isValidIsCorrect(value: unknown): value is "true" | undefined {
    return value === undefined || value === "true";
}

function isValidZone(value: unknown): value is HotspotZone {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as {shape?: unknown; coords?: unknown; is_correct?: unknown};
    if (!isValidIsCorrect(candidate.is_correct)) return false;
    if (typeof candidate.coords !== "object" || candidate.coords === null) return false;
    const coords = candidate.coords as Record<string, unknown>;
    if (candidate.shape === "rect") {
        return (
            isPercent(coords.x) &&
            isPercent(coords.y) &&
            isPercent(coords.width) &&
            isPercent(coords.height)
        );
    }
    if (candidate.shape === "circle") {
        return isPercent(coords.cx) && isPercent(coords.cy) && isPercent(coords.radius);
    }
    return false;
}

/** Read the payload, or null when it is not shaped right (``src`` string,
 *  ``zones`` an array of valid rect/circle zones). */
export function asHotspotPayload(
    exercise: ContentLessonExercise,
): HotspotPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (typeof payload.src !== "string") return null;
    if (!Array.isArray(payload.zones) || !payload.zones.every(isValidZone)) {
        return null;
    }
    return {src: payload.src, zones: payload.zones as HotspotZone[]};
}

/** ENGINE half: validate one ``ext:al-hotspot`` payload. Mirrors the
 *  engine reference rules (shape, non-empty src, zone count, exactly one
 *  correct zone). Returns human-readable messages; empty when valid. */
export function hotspotPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asHotspotPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with src (string) and zones (rect/circle[])`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.src.trim() === "") {
        payloadErrors.push(`'${exercise.id}' needs a non-empty src image reference`);
    }
    if (payload.zones.length < 2) {
        payloadErrors.push(`'${exercise.id}' needs at least 2 zones`);
        return payloadErrors;
    }
    const correctCount = payload.zones.filter(
        (zone) => zone.is_correct === "true",
    ).length;
    if (correctCount !== 1) {
        payloadErrors.push(
            `'${exercise.id}' needs exactly one correct zone (has ${correctCount})`,
        );
    }
    return payloadErrors;
}

/** True when the point ``(x, y)`` (percentages 0-100) falls inside
 *  ``zone``, edges/radius inclusive. */
function zoneContains(zone: HotspotZone, x: number, y: number): boolean {
    if (zone.shape === "rect") {
        const {x: zx, y: zy, width, height} = zone.coords;
        return x >= zx && x <= zx + width && y >= zy && y <= zy + height;
    }
    const {cx, cy, radius} = zone.coords;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
}

/** Hit-test a click at ``(x, y)`` (percentages 0-100 of the rendered
 *  image) against ``zones``. Returns the index of the first zone the point
 *  falls inside (edges/radius inclusive), or null on a miss. Pure —
 *  exported so the hit-test contract can be unit-tested without a
 *  rendered SVG. */
export function hitTestHotspotZones(
    zones: readonly HotspotZone[],
    x: number,
    y: number,
): number | null {
    const index = zones.findIndex((zone) => zoneContains(zone, x, y));
    return index === -1 ? null : index;
}

/** Convert a click's viewport coordinates into a percentage point (0-100)
 *  relative to ``rect``, or null when ``rect`` has no measurable size
 *  (e.g. not yet laid out). Pure — exported so the conversion is testable
 *  without simulating a real click. Shared between the renderer's overlay
 *  and the authoring drag-to-draw canvas (#3110), so both convert a mouse
 *  event into the same percentage space the exact same way. */
export function pointToPercent(
    rect: {left: number; top: number; width: number; height: number},
    clientX: number,
    clientY: number,
): {x: number; y: number} | null {
    if (rect.width === 0 || rect.height === 0) return null;
    return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
    };
}

/** The canonical SRS element key: ``<src>#zone-<correctIndex>``. There is
 *  no textual label to key on (a zone is an image region, not a word), so
 *  this composite stays stable across attempts as long as the content's
 *  zone order doesn't change. Empty string when the payload is malformed
 *  or carries no correct zone (mirrors the other ``canonical*`` helpers'
 *  fail-safe contract). */
export function canonicalHotspotKey(exercise: ContentLessonExercise): string {
    const payload = asHotspotPayload(exercise);
    if (!payload) return "";
    const correctIndex = payload.zones.findIndex((zone) => zone.is_correct === "true");
    if (correctIndex === -1) return "";
    return `${payload.src}#zone-${correctIndex}`;
}
