/**
 * Payload-validation tests for ``ext:al-hotspot`` (#3110) — the app-side
 * mirror of the engine's ``ext:ref-hotspot`` reference rules.
 */

import {describe, expect, it} from "vitest";

import {
    asHotspotPayload,
    hitTestHotspotZones,
    hotspotPayloadErrors,
    HOTSPOT_EXT_TYPE,
} from "./hotspot";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-hotspot",
        type: HOTSPOT_EXT_TYPE,
        prompt: "Click the capital.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

const RECT_ZONE = {
    shape: "rect",
    coords: {x: 10, y: 10, width: 20, height: 20},
    is_correct: "true",
} as const;
const CIRCLE_ZONE = {
    shape: "circle",
    coords: {cx: 70, cy: 70, radius: 15},
} as const;

describe("hotspotPayloadErrors (#3110)", () => {
    it("accepts a well-formed payload (rect + circle, exactly one correct)", () => {
        const ex = _exercise({src: "assets/map.png", zones: [RECT_ZONE, CIRCLE_ZONE]});
        expect(hotspotPayloadErrors(ex)).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const errors = hotspotPayloadErrors(_exercise(undefined));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ext_payload");
    });

    it("rejects a non-string src (SHAPE)", () => {
        expect(
            hotspotPayloadErrors(_exercise({src: 1, zones: [RECT_ZONE]}))[0],
        ).toContain("ext_payload");
    });

    it("rejects an empty src (SRC)", () => {
        const errors = hotspotPayloadErrors(
            _exercise({src: "  ", zones: [RECT_ZONE, CIRCLE_ZONE]}),
        );
        expect(errors.some((e) => e.includes("src") || e.includes("image"))).toBe(true);
    });

    it("rejects an unknown shape (SHAPE)", () => {
        const badZone = {shape: "triangle", coords: {x: 1, y: 1, width: 1, height: 1}};
        expect(
            hotspotPayloadErrors(_exercise({src: "a.png", zones: [badZone]}))[0],
        ).toContain("ext_payload");
    });

    it("rejects an out-of-range coordinate (SHAPE)", () => {
        const oob = {shape: "rect", coords: {x: -1, y: 0, width: 10, height: 10}};
        expect(
            hotspotPayloadErrors(_exercise({src: "a.png", zones: [oob, CIRCLE_ZONE]}))[0],
        ).toContain("ext_payload");
    });

    it("rejects zero correct zones (ZONES)", () => {
        const noneCorrect = {...RECT_ZONE, is_correct: undefined};
        const errors = hotspotPayloadErrors(
            _exercise({src: "a.png", zones: [noneCorrect, CIRCLE_ZONE]}),
        );
        expect(errors.some((e) => e.includes("exactly one"))).toBe(true);
    });

    it("rejects more than one correct zone (ZONES)", () => {
        const bothCorrect = {...CIRCLE_ZONE, is_correct: "true"};
        const errors = hotspotPayloadErrors(
            _exercise({src: "a.png", zones: [RECT_ZONE, bothCorrect]}),
        );
        expect(errors.some((e) => e.includes("exactly one"))).toBe(true);
    });

    it("rejects fewer than 2 zones (ZONES)", () => {
        const errors = hotspotPayloadErrors(_exercise({src: "a.png", zones: [RECT_ZONE]}));
        expect(errors.some((e) => e.includes("at least 2"))).toBe(true);
    });
});

describe("asHotspotPayload", () => {
    it("returns the payload when shaped right", () => {
        const ex = _exercise({src: "a.png", zones: [RECT_ZONE, CIRCLE_ZONE]});
        expect(asHotspotPayload(ex)).toEqual({src: "a.png", zones: [RECT_ZONE, CIRCLE_ZONE]});
    });

    it("returns null when malformed", () => {
        expect(asHotspotPayload(_exercise(undefined))).toBeNull();
    });
});

describe("hitTestHotspotZones (#3110)", () => {
    const zones = [RECT_ZONE, CIRCLE_ZONE] as const;

    it("hits a rect zone inside its bounds", () => {
        expect(hitTestHotspotZones(zones, 15, 15)).toBe(0);
    });

    it("hits a rect zone exactly on its edge (inclusive)", () => {
        expect(hitTestHotspotZones(zones, 10, 10)).toBe(0);
        expect(hitTestHotspotZones(zones, 30, 30)).toBe(0);
    });

    it("hits a circle zone inside its radius", () => {
        expect(hitTestHotspotZones(zones, 70, 70)).toBe(1);
    });

    it("hits a circle zone exactly on its edge (inclusive)", () => {
        expect(hitTestHotspotZones(zones, 85, 70)).toBe(1);
    });

    it("returns null for a miss (outside every zone)", () => {
        expect(hitTestHotspotZones(zones, 50, 50)).toBeNull();
    });

    it("returns the first matching zone when zones overlap", () => {
        const overlapping = [RECT_ZONE, {...RECT_ZONE, is_correct: undefined}] as const;
        expect(hitTestHotspotZones(overlapping, 15, 15)).toBe(0);
    });
});
