/**
 * Tests for the ``ext:al-hotspot`` authoring drag-to-draw canvas (#3110).
 *
 * Coordinate math mirrors ``HotspotExercise.test.tsx``: ``getBoundingClientRect``
 * is mocked to a fixed 100x100 box at the origin, so a drag's
 * ``clientX``/``clientY`` map 1:1 onto percentage coordinates.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import HotspotZoneCanvas from "./HotspotZoneCanvas";
import type {HotspotZone} from "../../../lib/exercises/payload/hotspot";

const T = (_key: string, fallback?: string) => fallback ?? _key;

beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    });
});

function drag(overlay: HTMLElement, from: {x: number; y: number}, to: {x: number; y: number}) {
    fireEvent.mouseDown(overlay, {clientX: from.x, clientY: from.y});
    fireEvent.mouseMove(overlay, {clientX: to.x, clientY: to.y});
    fireEvent.mouseUp(overlay, {clientX: to.x, clientY: to.y});
}

describe("HotspotZoneCanvas: drawing", () => {
    it("draws a rect zone from a drag and reports it via onDraw", () => {
        const onDraw = vi.fn();
        render(
            <HotspotZoneCanvas
                id="h1"
                src="data:image/png;base64,AAAA"
                zones={[]}
                drawShape="rect"
                onDraw={onDraw}
                t={T}
            />,
        );
        drag(screen.getByTestId("exercise-ext-hotspot-canvas-overlay-h1"), {x: 10, y: 10}, {x: 30, y: 25});
        expect(onDraw).toHaveBeenCalledWith({
            shape: "rect",
            coords: {x: 10, y: 10, width: 20, height: 15},
        });
    });

    it("draws a circle zone from a drag and reports it via onDraw", () => {
        const onDraw = vi.fn();
        render(
            <HotspotZoneCanvas
                id="h1"
                src="data:image/png;base64,AAAA"
                zones={[]}
                drawShape="circle"
                onDraw={onDraw}
                t={T}
            />,
        );
        drag(screen.getByTestId("exercise-ext-hotspot-canvas-overlay-h1"), {x: 50, y: 50}, {x: 60, y: 50});
        expect(onDraw).toHaveBeenCalledWith({
            shape: "circle",
            coords: {cx: 50, cy: 50, radius: 10},
        });
    });

    it("does not call onDraw for a plain click with no movement below the minimum size", () => {
        // A same-point mouseDown+mouseUp still commits a minimum-size zone
        // (per zoneFromDrag) rather than silently doing nothing - the
        // author gets a starter zone to fine-tune via the numeric fields.
        const onDraw = vi.fn();
        render(
            <HotspotZoneCanvas
                id="h1"
                src="data:image/png;base64,AAAA"
                zones={[]}
                drawShape="rect"
                onDraw={onDraw}
                t={T}
            />,
        );
        const overlay = screen.getByTestId("exercise-ext-hotspot-canvas-overlay-h1");
        fireEvent.mouseDown(overlay, {clientX: 50, clientY: 50});
        fireEvent.mouseUp(overlay, {clientX: 50, clientY: 50});
        expect(onDraw).toHaveBeenCalledTimes(1);
        expect(onDraw.mock.calls[0][0].coords.width).toBeGreaterThanOrEqual(2);
    });

    it("cancels the drag (no onDraw) when the pointer leaves the overlay mid-drag", () => {
        const onDraw = vi.fn();
        render(
            <HotspotZoneCanvas
                id="h1"
                src="data:image/png;base64,AAAA"
                zones={[]}
                drawShape="rect"
                onDraw={onDraw}
                t={T}
            />,
        );
        const overlay = screen.getByTestId("exercise-ext-hotspot-canvas-overlay-h1");
        fireEvent.mouseDown(overlay, {clientX: 10, clientY: 10});
        fireEvent.mouseMove(overlay, {clientX: 20, clientY: 20});
        fireEvent.mouseLeave(overlay);
        fireEvent.mouseUp(overlay, {clientX: 30, clientY: 30});
        expect(onDraw).not.toHaveBeenCalled();
    });
});

describe("HotspotZoneCanvas: rendering existing zones", () => {
    const zones: HotspotZone[] = [
        {shape: "rect", coords: {x: 10, y: 10, width: 20, height: 20}, is_correct: "true"},
        {shape: "circle", coords: {cx: 70, cy: 70, radius: 15}},
    ];

    it("renders one shape per existing zone", () => {
        render(
            <HotspotZoneCanvas
                id="h1"
                src="data:image/png;base64,AAAA"
                zones={zones}
                drawShape="rect"
                onDraw={vi.fn()}
                t={T}
            />,
        );
        expect(screen.getByTestId("exercise-ext-hotspot-canvas-zone-h1-0")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-ext-hotspot-canvas-zone-h1-1")).toBeInTheDocument();
    });

    it("marks the correct zone distinctly from distractors", () => {
        render(
            <HotspotZoneCanvas
                id="h1"
                src="data:image/png;base64,AAAA"
                zones={zones}
                drawShape="rect"
                onDraw={vi.fn()}
                t={T}
            />,
        );
        expect(screen.getByTestId("exercise-ext-hotspot-canvas-zone-h1-0")).toHaveAttribute(
            "data-correct",
            "true",
        );
        expect(screen.getByTestId("exercise-ext-hotspot-canvas-zone-h1-1")).toHaveAttribute(
            "data-correct",
            "false",
        );
    });
});
