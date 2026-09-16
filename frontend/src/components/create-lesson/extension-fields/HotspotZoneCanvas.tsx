/**
 * Drag-to-draw zone canvas for ``ext:al-hotspot`` authoring (#3110): an
 * image with an SVG overlay where the author drags out a rect or circle
 * directly on the picture, instead of typing coordinates blind.
 *
 * Mirrors the RENDERER's own overlay (``HotspotExercise.tsx``'s
 * ``HotspotStimulus``/``pointToPercent``) so authoring and playing use the
 * same 0-100 percentage coordinate space; the shape math itself lives in
 * {@link zoneFromDrag}, kept pure and separately tested. Existing zones
 * render read-only here (unlike the renderer, hiding the correct zone
 * makes no sense while authoring it) - fine-tuning position/size and
 * marking a zone correct still happens via the numeric fields + radio in
 * ``HotspotFields``, which this canvas complements rather than replaces.
 */

import {useState} from "react";

import {pointToPercent, type HotspotZone} from "../../../lib/exercises/payload/hotspot";
import {zoneFromDrag, type DragPoint} from "../../../lib/exercises/authoring/hotspot-zone-draw";

type Translate = (key: string, fallback?: string) => string;

export interface HotspotZoneCanvasProps {
    id: string;
    src: string;
    zones: readonly HotspotZone[];
    /** The shape the next drag draws; a sibling shape-select control owns
     *  this choice (mirrors the per-zone shape select already in
     *  ``HotspotFields``). */
    drawShape: "rect" | "circle";
    onDraw: (zone: HotspotZone) => void;
    t: Translate;
}

/** One read-only preview shape for an already-authored zone. */
function ExistingZone({zone, index, id}: {zone: HotspotZone; index: number; id: string}) {
    const isCorrect = zone.is_correct === "true";
    const className = isCorrect
        ? "fill-[color-mix(in_srgb,var(--exercise-correct)_25%,transparent)] stroke-[var(--exercise-correct)]"
        : "fill-[color-mix(in_srgb,var(--accent)_15%,transparent)] stroke-[var(--border-primary)]";
    const common = {
        className: `${className} stroke-2`,
        "data-testid": `exercise-ext-hotspot-canvas-zone-${id}-${index}`,
        "data-correct": isCorrect ? "true" : "false",
    };
    if (zone.shape === "rect") {
        const {x, y, width, height} = zone.coords;
        return <rect x={x} y={y} width={width} height={height} {...common} />;
    }
    const {cx, cy, radius} = zone.coords;
    return <circle cx={cx} cy={cy} r={radius} {...common} />;
}

/** The dashed preview shape while a drag is in progress. */
function DragPreview({shape, start, current}: {shape: "rect" | "circle"; start: DragPoint; current: DragPoint}) {
    const zone = zoneFromDrag(shape, start, current);
    const common = {
        className: "fill-[color-mix(in_srgb,var(--accent)_20%,transparent)] stroke-[var(--accent)]",
        strokeDasharray: "3 2",
        "data-testid": "exercise-ext-hotspot-canvas-drag-preview",
    };
    if (zone.shape === "rect") {
        const {x, y, width, height} = zone.coords;
        return <rect x={x} y={y} width={width} height={height} strokeWidth={1} {...common} />;
    }
    const {cx, cy, radius} = zone.coords;
    return <circle cx={cx} cy={cy} r={radius} strokeWidth={1} {...common} />;
}

export default function HotspotZoneCanvas({id, src, zones, drawShape, onDraw, t}: HotspotZoneCanvasProps) {
    const [dragStart, setDragStart] = useState<DragPoint | null>(null);
    const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);

    function pointFrom(event: React.MouseEvent<SVGSVGElement>): DragPoint | null {
        return pointToPercent(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    }

    function handleMouseDown(event: React.MouseEvent<SVGSVGElement>) {
        const point = pointFrom(event);
        if (!point) return;
        setDragStart(point);
        setDragCurrent(point);
    }

    function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
        if (!dragStart) return;
        const point = pointFrom(event);
        if (point) setDragCurrent(point);
    }

    function endDrag() {
        setDragStart(null);
        setDragCurrent(null);
    }

    function handleMouseUp(event: React.MouseEvent<SVGSVGElement>) {
        if (!dragStart) return;
        const point = pointFrom(event) ?? dragCurrent ?? dragStart;
        onDraw(zoneFromDrag(drawShape, dragStart, point));
        endDrag();
    }

    return (
        <div
            className="relative w-full max-w-xl"
            data-testid={`exercise-ext-hotspot-canvas-${id}`}
        >
            <img
                src={src}
                alt={t("create_lesson.extensions.edit.hotspot_canvas_alt", "Drag to draw a zone")}
                className="w-full rounded-md border border-border object-contain"
                data-testid={`exercise-ext-hotspot-canvas-image-${id}`}
            />
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full cursor-crosshair select-none"
                data-testid={`exercise-ext-hotspot-canvas-overlay-${id}`}
                role="img"
                aria-label={t(
                    "create_lesson.extensions.edit.hotspot_canvas_aria",
                    "Drag on the image to draw a zone",
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={endDrag}
            >
                {zones.map((zone, index) => (
                    <ExistingZone key={index} zone={zone} index={index} id={id} />
                ))}
                {dragStart && dragCurrent && (
                    <DragPreview shape={drawShape} start={dragStart} current={dragCurrent} />
                )}
            </svg>
        </div>
    );
}
