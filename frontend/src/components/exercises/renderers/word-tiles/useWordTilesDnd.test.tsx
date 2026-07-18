/**
 * useWordTilesDnd (#1776 follow-up).
 *
 * Direct hook-level pins on top of the WordTilesExercise component
 * tests: the stable per-mount display shuffle, the scrambled-bar
 * derivation, the place/remove/reorder handlers with their
 * submitted-guards, and the drag-end delegation to
 * ``applyDragReorder`` (whose pure contract is pinned separately).
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {applyDragReorder, useWordTilesDnd} from "./useWordTilesDnd";
import type {DragEndEvent} from "@dnd-kit/core";

const TILES = ["a", "b", "c", "d"];

function mount(initial: {placed?: number[]; submitted?: boolean} = {}) {
    let placed = initial.placed ?? [];
    const setPlaced = vi.fn(
        (next: number[] | ((prev: number[]) => number[])) => {
            placed = typeof next === "function" ? next(placed) : next;
        },
    );
    const hook = renderHook(
        ({placedProp, submitted}) =>
            useWordTilesDnd({
                exerciseId: "ex1",
                tiles: TILES,
                placed: placedProp,
                setPlaced,
                submitted,
            }),
        {
            initialProps: {
                placedProp: placed,
                submitted: initial.submitted ?? false,
            },
        },
    );
    return {hook, setPlaced, latestPlaced: () => placed};
}

describe("useWordTilesDnd", () => {
    it("derives a full scrambled bar that shrinks as tiles are placed", () => {
        const {hook} = mount({placed: [1]});
        const {scrambledIndices} = hook.result.current;
        expect(scrambledIndices).toHaveLength(TILES.length - 1);
        expect(scrambledIndices).not.toContain(1);
        expect([...scrambledIndices].sort()).toEqual([0, 2, 3]);
    });

    it("keeps the display shuffle stable across re-renders", () => {
        const {hook} = mount();
        const first = [...hook.result.current.scrambledIndices];
        hook.rerender({placedProp: [], submitted: false});
        expect(hook.result.current.scrambledIndices).toEqual(first);
    });

    it("handlePlace appends once and ignores an already-placed tile", () => {
        const {hook, setPlaced, latestPlaced} = mount({placed: [2]});
        act(() => hook.result.current.handlePlace(0));
        expect(latestPlaced()).toEqual([2, 0]);
        setPlaced.mockClear();
        act(() => hook.result.current.handlePlace(2));
        expect(setPlaced).not.toHaveBeenCalled();
    });

    it("handleReturn removes the tile; reorder moves within bounds only", () => {
        const {hook, setPlaced, latestPlaced} = mount({placed: [0, 1, 2]});
        act(() => hook.result.current.handleReturn(1));
        expect(latestPlaced()).toEqual([0, 2]);
        setPlaced.mockClear();
        act(() => hook.result.current.reorder(0, 2));
        expect(latestPlaced()).toEqual([1, 2, 0]);
        setPlaced.mockClear();
        act(() => hook.result.current.reorder(0, -1));
        act(() => hook.result.current.reorder(0, 3));
        expect(setPlaced).not.toHaveBeenCalled();
    });

    it("every mutating handler no-ops once submitted", () => {
        const {hook, setPlaced} = mount({placed: [0, 1], submitted: true});
        act(() => {
            hook.result.current.handlePlace(2);
            hook.result.current.handleReturn(0);
            hook.result.current.reorder(0, 1);
            hook.result.current.handleDragEnd({
                active: {id: "0"},
                over: {id: "1"},
            } as unknown as DragEndEvent);
        });
        expect(setPlaced).not.toHaveBeenCalled();
    });

    it("handleDragEnd applies the drag reorder and clears the overlay", () => {
        const {hook, latestPlaced} = mount({placed: [0, 1, 2]});
        act(() =>
            hook.result.current.handleDragStart({
                active: {id: "0"},
            } as unknown as Parameters<
                typeof hook.result.current.handleDragStart
            >[0]),
        );
        expect(hook.result.current.activeId).toBe(0);
        act(() =>
            hook.result.current.handleDragEnd({
                active: {id: "0"},
                over: {id: "2"},
            } as unknown as DragEndEvent),
        );
        expect(hook.result.current.activeId).toBeNull();
        expect(latestPlaced()).toEqual(applyDragReorder([0, 1, 2], "0", "2"));
        expect(latestPlaced()).toEqual([1, 2, 0]);
    });
});
