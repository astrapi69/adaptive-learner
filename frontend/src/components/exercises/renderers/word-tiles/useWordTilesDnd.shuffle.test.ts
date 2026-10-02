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
 *
 * #3214 adds both directions of the per-mount seed, which this hook owns for
 * word tiles, audio tiles, ordering and parsons: in production the bar follows
 * ``Date.now() & 0xffff`` (a parsons solution never becomes recognisable by
 * position), under the visual random pin it ignores the clock.
 */

import {renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useWordTilesDnd} from "./useWordTilesDnd";
import {seededShuffle} from "../../../../lib/exercises/grading/seeded-shuffle";
import {
    FROZEN_VISUAL_NOW,
    OTHER_INSTANTS,
    VISUAL_RANDOM_PIN,
    clearRandomPin,
    installVisualRandomPin,
} from "../../../../test-utils/visual-random-pin";

const TILES = ["a", "b", "c", "d"];

function mountDisplayOrder(
    exerciseId: string,
    tiles: readonly string[] = TILES,
): number[] {
    const {result, unmount} = renderHook(() =>
        useWordTilesDnd({
            exerciseId,
            tiles: [...tiles],
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
    clearRandomPin();
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

const CLOCK_ID = "ex-tiles-clock";
const SEVEN_TILES = ["a", "b", "c", "d", "e", "f", "g"];
const SEVEN_INDICES = [0, 1, 2, 3, 4, 5, 6];

function scrambledAt(now: number): number[] {
    vi.spyOn(Date, "now").mockReturnValue(now);
    return mountDisplayOrder(CLOCK_ID, SEVEN_TILES);
}

/** The scrambled order ``seededShuffle`` gives for a mount suffix. */
function scrambledForSuffix(suffix: number): number[] {
    return seededShuffle(SEVEN_INDICES, `${CLOCK_ID}#${suffix}`);
}

describe("useWordTilesDnd: production mount seed follows the clock (#3214)", () => {
    it.each([
        {name: "the frozen visual instant", now: FROZEN_VISUAL_NOW},
        ...OTHER_INSTANTS,
    ])("seeds with id#(Date.now() & 0xffff) at $name", ({now}) => {
        expect(scrambledAt(now)).toEqual(scrambledForSuffix(now & 0xffff));
        expect(Date.now).toHaveBeenCalled();
    });

    it("two mounts whose clock low bits differ get different orders", () => {
        const [first, second] = OTHER_INSTANTS;
        expect(first.now & 0xffff).not.toBe(second.now & 0xffff);
        expect(scrambledAt(second.now)).not.toEqual(scrambledAt(first.now));
    });
});

describe("useWordTilesDnd: mount seed under the visual random pin (#3214)", () => {
    it.each(OTHER_INSTANTS)("scrambles in the visual-seed order at $name", ({now}) => {
        expect(now & 0xffff).not.toBe(VISUAL_RANDOM_PIN.mountSalt);
        installVisualRandomPin();
        expect(scrambledAt(now)).toEqual(
            scrambledForSuffix(VISUAL_RANDOM_PIN.mountSalt),
        );
    });

    it("keeps the order the frozen visual clock produced before #3214", () => {
        const unpinnedAtFrozenClock = scrambledAt(FROZEN_VISUAL_NOW);
        installVisualRandomPin();
        expect(scrambledAt(OTHER_INSTANTS[1].now)).toEqual(unpinnedAtFrozenClock);
    });
});
