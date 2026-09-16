/**
 * Pure geometry behind the ``ext:al-hotspot`` authoring canvas (#3110):
 * turns a drag's start/end percentage points into a {@link HotspotZone}.
 * No React, no DOM — the canvas component converts mouse events into
 * percentage points (mirroring the renderer's own {@link pointToPercent}
 * in ``HotspotExercise.tsx``) and this module does the shape math.
 */

import type {HotspotZone} from "../payload/hotspot";

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;
/** A drag shorter than this (in percentage units) still produces a
 *  visible, selectable zone instead of a zero-area one from a stray
 *  click or an imprecise touch. */
const MIN_SIZE = 2;

export interface DragPoint {
    x: number;
    y: number;
}

function clampPercent(value: number): number {
    return Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, value));
}

/** Builds the zone a rect-drag from ``start`` to ``end`` describes:
 *  normalizes any drag direction into a top-left corner + size, clamps
 *  to the 0-100 percentage range, and enforces a minimum width/height. */
function rectFromDrag(start: DragPoint, end: DragPoint): HotspotZone {
    const x0 = clampPercent(Math.min(start.x, end.x));
    const y0 = clampPercent(Math.min(start.y, end.y));
    const x1 = clampPercent(Math.max(start.x, end.x));
    const y1 = clampPercent(Math.max(start.y, end.y));
    const width = Math.max(x1 - x0, MIN_SIZE);
    const height = Math.max(y1 - y0, MIN_SIZE);
    return {shape: "rect", coords: {x: x0, y: y0, width, height}};
}

/** Builds the zone a circle-drag describes: ``start`` is the center,
 *  the radius is the Euclidean distance to ``end``, clamped/floored the
 *  same way {@link rectFromDrag} clamps its rectangle. */
function circleFromDrag(start: DragPoint, end: DragPoint): HotspotZone {
    const cx = clampPercent(start.x);
    const cy = clampPercent(start.y);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const radius = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_SIZE);
    return {shape: "circle", coords: {cx, cy, radius}};
}

/** Turns a drag's start/end percentage points into a concrete
 *  {@link HotspotZone} of ``shape``, never ``null`` — even a stray
 *  same-point click produces a minimum-size zone the author can then
 *  fine-tune via the numeric fields. */
export function zoneFromDrag(
    shape: "rect" | "circle",
    start: DragPoint,
    end: DragPoint,
): HotspotZone {
    return shape === "rect" ? rectFromDrag(start, end) : circleFromDrag(start, end);
}
