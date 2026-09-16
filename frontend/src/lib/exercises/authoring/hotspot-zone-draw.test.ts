/**
 * Tests for ``zoneFromDrag`` (#3110), the pure geometry behind the
 * hotspot zone editor's drag-to-draw canvas.
 */

import {describe, expect, it} from "vitest";

import {zoneFromDrag} from "./hotspot-zone-draw";

describe("zoneFromDrag — rect", () => {
    it("builds a rect from two corners regardless of drag direction", () => {
        expect(zoneFromDrag("rect", {x: 10, y: 10}, {x: 30, y: 25})).toEqual({
            shape: "rect",
            coords: {x: 10, y: 10, width: 20, height: 15},
        });
    });

    it("normalizes a drag that goes up-left (end before start)", () => {
        expect(zoneFromDrag("rect", {x: 30, y: 25}, {x: 10, y: 10})).toEqual({
            shape: "rect",
            coords: {x: 10, y: 10, width: 20, height: 15},
        });
    });

    it("clamps coordinates to the 0-100 percentage range", () => {
        expect(zoneFromDrag("rect", {x: -5, y: 90}, {x: 105, y: 150})).toEqual({
            shape: "rect",
            coords: {x: 0, y: 90, width: 100, height: 10},
        });
    });

    it("enforces a minimum size so a stray click never creates a zero-area zone", () => {
        const zone = zoneFromDrag("rect", {x: 50, y: 50}, {x: 50.1, y: 50.1});
        expect(zone).not.toBeNull();
        if (zone?.shape === "rect") {
            expect(zone.coords.width).toBeGreaterThanOrEqual(2);
            expect(zone.coords.height).toBeGreaterThanOrEqual(2);
        }
    });
});

describe("zoneFromDrag — circle", () => {
    it("builds a circle centered on the start point, radius to the end point", () => {
        expect(zoneFromDrag("circle", {x: 50, y: 50}, {x: 60, y: 50})).toEqual({
            shape: "circle",
            coords: {cx: 50, cy: 50, radius: 10},
        });
    });

    it("computes the radius via Euclidean distance for a diagonal drag", () => {
        // 3-4-5 triangle: dx=3, dy=4 -> radius=5.
        expect(zoneFromDrag("circle", {x: 0, y: 0}, {x: 3, y: 4})).toEqual({
            shape: "circle",
            coords: {cx: 0, cy: 0, radius: 5},
        });
    });

    it("clamps the center to the 0-100 range", () => {
        const zone = zoneFromDrag("circle", {x: -10, y: 50}, {x: 0, y: 50});
        expect(zone?.shape).toBe("circle");
        if (zone?.shape === "circle") {
            expect(zone.coords.cx).toBe(0);
        }
    });

    it("enforces a minimum radius so a stray click never creates a zero-area zone", () => {
        const zone = zoneFromDrag("circle", {x: 50, y: 50}, {x: 50.1, y: 50.1});
        expect(zone).not.toBeNull();
        if (zone?.shape === "circle") {
            expect(zone.coords.radius).toBeGreaterThanOrEqual(2);
        }
    });
});
