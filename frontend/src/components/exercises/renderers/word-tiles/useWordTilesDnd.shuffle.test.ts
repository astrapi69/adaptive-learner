/**
 * Distribution pin for the word-tiles display shuffle (#2372).
 *
 * The pre-fix local `_shuffle` (acc*31 hash + LCG 1103515245, the same
 * degenerate copy as the matching renderer, #2371) never placed the
 * first solution tile on the first three display positions and pinned
 * it to the LAST slot in 99.8% of mounts with 4 tiles, so the tile bar
 * leaked the sentence in near-reverse order. Pins, over many mounts:
 * no fixed display position for the first solution tile, and mount-
 * stable order.
 */

import {renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useWordTilesDnd} from "./useWordTilesDnd";

const TILES = ["a", "b", "c", "d"];

function mountDisplayOrder(exerciseId: string): number[] {
    const {result, unmount} = renderHook(() =>
        useWordTilesDnd({
            exerciseId,
            tiles: TILES,
            placed: [],
            setPlaced: vi.fn(),
            submitted: false,
        }),
    );
    const order = [...result.current.scrambledIndices];
    unmount();
    return order;
}

beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(123456789);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("useWordTilesDnd: display shuffle distribution (#2372)", () => {
    it("does not pin the first solution tile to a fixed display position", () => {
        const positions: number[] = [];
        for (let mount = 0; mount < 60; mount++) {
            positions.push(
                mountDisplayOrder(`ex-tiles-${mount}`).indexOf(0),
            );
        }
        const lastShare =
            positions.filter((p) => p === 3).length / positions.length;
        expect(new Set(positions).size).toBeGreaterThan(1);
        expect(lastShare).toBeLessThan(0.6);
        expect(positions).toContain(0);
    });
});
