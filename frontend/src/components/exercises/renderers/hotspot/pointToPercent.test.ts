import {describe, expect, it} from "vitest";

import {pointToPercent} from "./HotspotExercise";

describe("pointToPercent (#3110)", () => {
    const rect = {left: 10, top: 20, width: 100, height: 50};

    it("converts a click into a percentage point relative to rect", () => {
        expect(pointToPercent(rect, 60, 45)).toEqual({x: 50, y: 50});
    });

    it("clamps to the rect's own origin at the top-left corner", () => {
        expect(pointToPercent(rect, 10, 20)).toEqual({x: 0, y: 0});
    });

    it("returns null when the rect has no measurable width", () => {
        expect(pointToPercent({left: 0, top: 0, width: 0, height: 50}, 5, 5)).toBeNull();
    });

    it("returns null when the rect has no measurable height", () => {
        expect(pointToPercent({left: 0, top: 0, width: 50, height: 0}, 5, 5)).toBeNull();
    });
});
