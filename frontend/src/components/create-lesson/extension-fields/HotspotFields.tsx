/**
 * Authoring fields for ``ext:al-hotspot`` (#3110): the stimulus image plus
 * its clickable zones. Pure + props-driven — the parent owns the
 * ``ext_payload``.
 *
 * The image reuses the shared {@link CardImageField} (mirrors
 * ``ImageDescriptionFields``'s image picker). Zone authoring combines TWO
 * complementary editors: {@link HotspotZoneCanvas} draws a new rect/circle
 * directly on the image (drag to size), and the structured numeric fields
 * below let the author fine-tune the drawn zone's exact coordinates or type
 * them precisely without dragging. Marking the correct zone stays a radio
 * on the structured row — no ambiguity about which control does what.
 */

import {useState} from "react";
import {Plus, X} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {CardImageField} from "../fields";
import HotspotZoneCanvas from "./HotspotZoneCanvas";
import type {HotspotZone} from "../../../lib/exercises/payload/hotspot";

type Translate = (key: string, fallback?: string) => string;

interface HotspotPayload {
    src: string;
    zones: HotspotZone[];
}

const BLANK_RECT_ZONE: HotspotZone = {
    shape: "rect",
    coords: {x: 10, y: 10, width: 20, height: 20},
};

function setCoord(zone: HotspotZone, key: string, value: number): HotspotZone {
    return {...zone, coords: {...zone.coords, [key]: value}} as HotspotZone;
}

/** The numeric coordinate fields for one zone, keyed by its shape. */
function ZoneCoordFields({
    zone,
    id,
    index,
    onChange,
}: {
    zone: HotspotZone;
    id: string;
    index: number;
    onChange: (next: HotspotZone) => void;
}) {
    const fields =
        zone.shape === "rect"
            ? (["x", "y", "width", "height"] as const)
            : (["cx", "cy", "radius"] as const);
    return (
        <div className="flex flex-wrap gap-2">
            {fields.map((key) => (
                <label key={key} className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-muted">{key}</span>
                    <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-20"
                        value={(zone.coords as Record<string, number>)[key]}
                        data-testid={`exercise-ext-hotspot-zone-${key}-${id}-${index}`}
                        onChange={(e) => onChange(setCoord(zone, key, Number(e.target.value)))}
                    />
                </label>
            ))}
        </div>
    );
}

export default function HotspotFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: HotspotPayload;
    onChange: (payload: HotspotPayload) => void;
    t: Translate;
}) {
    const src = payload?.src ?? "";
    const zones = payload?.zones ?? [];
    const [drawShape, setDrawShape] = useState<"rect" | "circle">("rect");

    function setZone(index: number, next: HotspotZone) {
        onChange({src, zones: zones.map((z, i) => (i === index ? next : z))});
    }
    function setShape(index: number, shape: "rect" | "circle") {
        const next: HotspotZone =
            shape === "rect"
                ? {...zones[index], shape: "rect", coords: {x: 10, y: 10, width: 20, height: 20}}
                : {...zones[index], shape: "circle", coords: {cx: 50, cy: 50, radius: 15}};
        setZone(index, next);
    }
    function markCorrect(index: number) {
        onChange({
            src,
            zones: zones.map((z, i) =>
                i === index ? {...z, is_correct: "true"} : {...z, is_correct: undefined},
            ),
        });
    }
    function addZone() {
        onChange({src, zones: [...zones, {...BLANK_RECT_ZONE}]});
    }
    function drawZone(zone: HotspotZone) {
        onChange({src, zones: [...zones, zone]});
    }
    function removeZone(index: number) {
        onChange({src, zones: zones.filter((_z, i) => i !== index)});
    }

    return (
        <div className="flex flex-col gap-3">
            <CardImageField
                value={src}
                onChange={(next) => onChange({src: next, zones})}
                idPrefix={`exercise-ext-hotspot-${id}`}
                label={t("create_lesson.extensions.edit.hotspot_image_label", "Stimulus image")}
                previewAlt={t(
                    "create_lesson.extensions.edit.hotspot_image_preview_alt",
                    "Stimulus image",
                )}
            />

            {src.trim().length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg-primary">
                            {t(
                                "create_lesson.extensions.edit.hotspot_draw_label",
                                "Draw a zone on the image",
                            )}
                        </span>
                        <select
                            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={drawShape}
                            data-testid={`exercise-ext-hotspot-draw-shape-${id}`}
                            onChange={(e) => setDrawShape(e.target.value as "rect" | "circle")}
                        >
                            <option value="rect">
                                {t("create_lesson.extensions.edit.hotspot_shape_rect", "Rectangle")}
                            </option>
                            <option value="circle">
                                {t("create_lesson.extensions.edit.hotspot_shape_circle", "Circle")}
                            </option>
                        </select>
                    </div>
                    <HotspotZoneCanvas
                        id={id}
                        src={src}
                        zones={zones}
                        drawShape={drawShape}
                        onDraw={drawZone}
                        t={t}
                    />
                </div>
            )}

            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                <legend className="text-sm font-medium text-fg-primary">
                    {t("create_lesson.extensions.edit.hotspot_zones_label", "Clickable zones")}
                </legend>
                {zones.map((zone, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3"
                        data-testid={`exercise-ext-hotspot-zone-${id}-${i}`}
                    >
                        <div className="flex items-center gap-2">
                            <select
                                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={zone.shape}
                                data-testid={`exercise-ext-hotspot-zone-shape-${id}-${i}`}
                                onChange={(e) => setShape(i, e.target.value as "rect" | "circle")}
                            >
                                <option value="rect">
                                    {t("create_lesson.extensions.edit.hotspot_shape_rect", "Rectangle")}
                                </option>
                                <option value="circle">
                                    {t("create_lesson.extensions.edit.hotspot_shape_circle", "Circle")}
                                </option>
                            </select>
                            <label className="flex items-center gap-1 text-sm">
                                <input
                                    type="radio"
                                    name={`exercise-ext-hotspot-correct-${id}`}
                                    className="accent-[var(--accent)]"
                                    checked={zone.is_correct === "true"}
                                    aria-label={t(
                                        "create_lesson.extensions.edit.hotspot_mark_correct",
                                        "This is the correct zone",
                                    )}
                                    data-testid={`exercise-ext-hotspot-zone-correct-${id}-${i}`}
                                    onChange={() => markCorrect(i)}
                                />
                                {t("create_lesson.extensions.edit.hotspot_correct_label", "Correct")}
                            </label>
                            <button
                                type="button"
                                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                                aria-label={t(
                                    "create_lesson.extensions.edit.hotspot_zone_remove",
                                    "Remove zone",
                                )}
                                data-testid={`exercise-ext-hotspot-zone-remove-${id}-${i}`}
                                onClick={() => removeZone(i)}
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        </div>
                        <ZoneCoordFields
                            zone={zone}
                            id={id}
                            index={i}
                            onChange={(next) => setZone(i, next)}
                        />
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    data-testid={`exercise-ext-hotspot-zone-add-${id}`}
                    onClick={addZone}
                >
                    <Plus size={14} aria-hidden="true" />
                    {t("create_lesson.extensions.edit.hotspot_zone_add", "Add zone")}
                </Button>
            </fieldset>
        </div>
    );
}
